// Content script for SyncStone Chrome extension

import { messages, SupportedLanguage, DEFAULT_LANGUAGE } from '@/locales/messages';
import { sanitizeFilename, sendErrorMessage, base64ToUint8Array, extractFilenameFromUrl } from '@/utils/helpers';
import { deleteDatabase } from '@/utils/indexedDB';
import {
  BlogEntry,
  ArticleDetails,
  DownloadAllImagesResponse,
  GetDownloadedImageResponse,
  FetchArticleResponse,
  FetchImageListPageResponse,
  ContentScriptMessage
} from '@/types';
import {
  extractBlogEntries,
  getPaginationInfo,
  extractArticleDetails,
  detectOwnBlog,
  scrapeImageListPageUrls,
  getImageListTotalPages
} from './scraper';
import { downloadZip } from './exporter';
import { processImagesAndConvertToMarkdown } from './markdown';
import { showExportNotification } from './notification';

// Current language for content script
let contentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

// Helper to get current language messages
function msg() {
  return messages[contentLanguage];
}

// Global cancellation flag
let isCancelled = false;

// Fetch page entries via background script
async function fetchPageEntries(pageUrl: string, delay: number): Promise<BlogEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'fetchPageInNewTab',
      url: pageUrl,
      delay
    }, (response) => {
      if (response?.success) {
        resolve(response.entries || []);
      } else {
        reject(new Error(response?.message || 'Failed to fetch page entries'));
      }
    });
  });
}

// Fetch article details via background script
async function fetchArticleDetails(articleUrl: string, delay: number): Promise<ArticleDetails> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'fetchArticleInNewTab',
      url: articleUrl,
      delay
    }, (response: FetchArticleResponse) => {
      if (response?.success && response.article) {
        resolve(response.article);
      } else {
        reject(new Error(response?.message || 'Failed to fetch article details'));
      }
    });
  });
}


// Handle single article export in content script
async function handleSingleArticleExportInContent(sendResponse: (response: { success: boolean; message?: string }) => void): Promise<void> {
  try {
    // Get article data
    const articleDetails = extractArticleDetails();
    
    if (!articleDetails.title || !articleDetails.bodyHtml) {
      throw new Error(msg().articleDataNotFound);
    }
    
    const imageMap: { [key: string]: string } = {};

    // Download images via background script (remove duplicates)
    const imageUrlsSet = new Set([...(articleDetails.imageUrls || []), ...(articleDetails.thumbnailUrls || [])]);
    const allImageUrls = Array.from(imageUrlsSet);
    
    if (allImageUrls.length > 0) {
      const downloadedImageData = await new Promise<DownloadAllImagesResponse>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'downloadAllImages',
          imageUrls: allImageUrls,
          totalImages: allImageUrls.length
        }, (response: DownloadAllImagesResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      // Add downloaded images to ZIP using pull-based approach
      if (downloadedImageData?.success) {
        for (const imageUrl of allImageUrls) {
          const imageResponse = await new Promise<GetDownloadedImageResponse>((resolve) => {
            chrome.runtime.sendMessage({
              action: 'getDownloadedImage',
              imageUrl: imageUrl
            }, resolve);
          });
          
          if (imageResponse?.success && imageResponse.imageData) {
            const imageData = imageResponse.imageData;
            if (imageData.success && imageData.base64) {
              const imagePath = `images/${imageData.filename}`;
              imageMap[imageData.url] = imagePath;
            } else {
              imageMap[imageData.url] = imageData.url;
            }
          } else {
            imageMap[imageUrl] = imageUrl;
          }
        }
      }
    }

    // Show article export progress
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'articles',
      current: 1,
      total: 1,
      currentItem: articleDetails.title
    });

    // Convert to markdown
    const markdownResult = processImagesAndConvertToMarkdown({
      title: articleDetails.title,
      htmlContent: articleDetails.bodyHtml,
      likes: articleDetails.likes,
      commentsCount: articleDetails.commentsCount,
      publishDate: articleDetails.publishDate,
      tags: articleDetails.tags,
      imageMap,
      thumbnailUrls: articleDetails.thumbnailUrls,
      commentsData: articleDetails.commentsData
    });

    if (!markdownResult.success || !markdownResult.markdown) {
      throw new Error(msg().markdownConversionFailed);
    }

    // Create single article ZIP using zip.js streaming
    const sanitizedTitle = sanitizeFilename(articleDetails.title);
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter());
    
    // Add markdown file
    await zipWriter.add(`${sanitizedTitle}.md`, new zip.TextReader(markdownResult.markdown));
    
    // Add all images to ZIP using streaming
    const imageUrls = Object.keys(imageMap).filter(url => imageMap[url].startsWith('images/'));
    for (const imageUrl of imageUrls) {
      const imageResponse = await new Promise<GetDownloadedImageResponse>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'getDownloadedImage',
          imageUrl: imageUrl
        }, resolve);
      });
      
      if (imageResponse?.success && imageResponse.imageData?.base64) {
        const imagePath = imageMap[imageUrl];
        try {
          const imageBytes = base64ToUint8Array(imageResponse.imageData.base64);
          await zipWriter.add(imagePath, new zip.Uint8ArrayReader(imageBytes));
        } catch (error) {
          console.error(`Failed to add image to single article ZIP:`, error);
        }
      }
    }
    
    const zipBlob = await zipWriter.close();
    await downloadZip(zipBlob, `${sanitizedTitle}.zip`);

    // Clean up IndexedDB after successful export
    try {
      await deleteDatabase();
      console.log('[Content] IndexedDB database deleted after single article export');
    } catch (error) {
      console.error('[Content] Failed to delete IndexedDB after single article export:', error);
    }

    sendResponse({ success: true, message: msg().singleArticleExported });
  } catch (error) {
    // Clean up IndexedDB even on error
    try {
      await deleteDatabase();
      console.log('[Content] IndexedDB database deleted after single article export error');
    } catch (clearError) {
      console.error('[Content] Failed to delete IndexedDB after single article export error:', clearError);
    }

    sendResponse({
      success: false,
      message: msg().failedToExport + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Collect and download all images from image list pages
async function collectAndDownloadAllImagesInContent(exportDelay: number): Promise<{ [key: string]: string }> {
  console.log('[collectAndDownloadAllImagesInContent] Function started');
  
  // 初期化：前回のデータをクリア
  const allImageUrls = new Set<string>();
  let currentPage = 1;
  let totalPages = 1;
  const imageMap: { [key: string]: string } = {};

  console.log('[collectAndDownloadAllImagesInContent] Starting image list page collection');
  // 画像一覧ページから画像URLを収集
  while (currentPage <= totalPages) {
    if (isCancelled) {
      break;
    }
    
    const imageUrlListPage = `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${currentPage}`;
    
    try {
      console.log(`[collectAndDownloadAllImagesInContent] Fetching page ${currentPage}: ${imageUrlListPage}`);
      // バックグラウンドにタブ作成を依頼
      const response = await new Promise<FetchImageListPageResponse>((resolve) => {
        chrome.runtime.sendMessage({
          action: 'fetchImageListPage',
          url: imageUrlListPage,
          delay: exportDelay
        }, resolve);
      });
      
      console.log(`[collectAndDownloadAllImagesInContent] Response for page ${currentPage}:`, response);
      
      if (response?.success && response.imageUrls) {
        response.imageUrls.forEach((url: string) => allImageUrls.add(url));
        if (currentPage === 1) {
          totalPages = response.totalPages || 1;
          console.log('[collectAndDownloadAllImagesInContent] First page response:', {
            imageCount: response.imageUrls.length,
            totalPages: totalPages,
            response: response
          });
        }
        // 各ページの進捗を更新（分母が確定してから）
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'images',
          current: currentPage,
          total: totalPages,
          pageInfo: { currentPage: currentPage, totalPages: totalPages, imageCount: allImageUrls.size }
        }).catch(() => {});
        console.log(`[collectAndDownloadAllImagesInContent] Completed page ${currentPage}/${totalPages}, total images so far: ${allImageUrls.size}`);
      } else {
        console.log(`[collectAndDownloadAllImagesInContent] Page ${currentPage} failed or no images found`);
      }
    } catch (error) {
      console.error(`Failed to scrape image list page: ${imageUrlListPage}`, error);
    }
    
    currentPage++;
    console.log(`[collectAndDownloadAllImagesInContent] Moving to page ${currentPage}`);
  }

  if (isCancelled) {
    return {};
  }

  // 収集した画像をBackground Scriptでダウンロード
  const imageUrlsArray = Array.from(allImageUrls);
  console.log('[collectAndDownloadAllImagesInContent] Total unique images collected:', imageUrlsArray.length);
  
  if (imageUrlsArray.length > 0) {
    console.log('[collectAndDownloadAllImagesInContent] Starting download of', imageUrlsArray.length, 'images');
    
    console.log('[collectAndDownloadAllImagesInContent] Sending downloadAllImages request to background...');
    let timeoutId: ReturnType<typeof setTimeout>;
    const downloadedImageData = await Promise.race<DownloadAllImagesResponse>([
      new Promise<DownloadAllImagesResponse>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'downloadAllImages',
          imageUrls: imageUrlsArray,
          totalImages: imageUrlsArray.length
        }, (response: DownloadAllImagesResponse) => {
          clearTimeout(timeoutId); // Clear timeout on success
          if (chrome.runtime.lastError) {
            console.error('[collectAndDownloadAllImagesInContent] Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('[collectAndDownloadAllImagesInContent] Download response received:', response);
            resolve(response);
          }
        });
      }),
      new Promise<DownloadAllImagesResponse>((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error('[collectAndDownloadAllImagesInContent] Timeout after 10 minutes');
          reject(new Error('Image download timeout after 10 minutes'));
        }, 10 * 60 * 1000); // 10 minutes timeout
      })
    ]);

    console.log('[collectAndDownloadAllImagesInContent] Await completed, downloadedImageData:', downloadedImageData);

    // Get downloaded images one by one if download was successful
    if (downloadedImageData?.success) {
      console.log('[PULL-LOG] ========== START PULL PHASE ==========');
      console.log('[PULL-LOG] Getting downloaded images from background one by one...');
      console.log('[PULL-LOG] Total images to pull:', imageUrlsArray.length);
      
      let pullSuccessCount = 0;
      let pullFailCount = 0;
      const pullFailedUrls: string[] = [];
      
      for (let i = 0; i < imageUrlsArray.length; i++) {
        const imageUrl = imageUrlsArray[i];
        
        if (isCancelled) {
          console.log('[PULL-LOG] Cancelled during image processing at', i + 1, '/', imageUrlsArray.length);
          break;
        }
        
        console.log(`[PULL-LOG] Pulling image ${i + 1}/${imageUrlsArray.length}: ${extractFilenameFromUrl(imageUrl)}`);

        const imageResponse = await new Promise<GetDownloadedImageResponse>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'getDownloadedImage',
            imageUrl: imageUrl
          }, resolve);
        });
        
        console.log(`[PULL-LOG] Pull response for image ${i + 1}:`, {
          success: imageResponse?.success,
          hasImageData: !!imageResponse?.imageData,
          imageDataSuccess: imageResponse?.imageData?.success,
          hasBase64: !!imageResponse?.imageData?.base64,
          base64Length: imageResponse?.imageData?.base64?.length,
          filename: imageResponse?.imageData?.filename
        });
        
        if (imageResponse?.success && imageResponse.imageData) {
          const imageData = imageResponse.imageData;
          if (imageData.success && imageData.base64) {
            const imagePath = `images/${imageData.filename}`;
            // Only update imageMap, don't add to main ZIP
            imageMap[imageData.url] = imagePath;
            pullSuccessCount++;
            console.log(`[PULL-LOG] Successfully pulled image ${i + 1}: ${imageData.filename} (${Math.round(imageData.base64.length/1024)}KB)`);
          } else {
            imageMap[imageData.url] = imageData.url;
            pullFailCount++;
            pullFailedUrls.push(imageUrl);
            console.log(`[PULL-LOG] Image ${i + 1} data invalid (no base64):`, imageData);
          }
        } else {
          imageMap[imageUrl] = imageUrl; // Fallback to original URL
          pullFailCount++;
          pullFailedUrls.push(imageUrl);
          console.log(`[PULL-LOG] Failed to pull image ${i + 1}:`, imageResponse);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[PULL-LOG] Pull progress: ${i + 1}/${imageUrlsArray.length} (${Math.round((i+1)/imageUrlsArray.length*100)}%)`);
          console.log(`[PULL-LOG] Success: ${pullSuccessCount}, Failed: ${pullFailCount}`);
        }
      }
      
      console.log('[PULL-LOG] ========== PULL PHASE COMPLETE ==========');
      console.log(`[PULL-LOG] Total images to pull: ${imageUrlsArray.length}`);
      console.log(`[PULL-LOG] Successfully pulled: ${pullSuccessCount}`);
      console.log(`[PULL-LOG] Failed to pull: ${pullFailCount}`);
      console.log(`[PULL-LOG] Pull success rate: ${Math.round(pullSuccessCount/imageUrlsArray.length*100)}%`);
      console.log(`[PULL-LOG] ImageMap size: ${Object.keys(imageMap).length}`);
      
      if (pullFailedUrls.length > 0) {
        console.log('[PULL-LOG] Failed pull URLs (first 10):', pullFailedUrls.slice(0, 10));
      }
      
      console.log('[collectAndDownloadAllImagesInContent] Image processing completed, added', Object.keys(imageMap).length, 'to imageMap');
    } else {
      console.error('[collectAndDownloadAllImagesInContent] Download failed:', downloadedImageData);
    }
  } else {
    console.log('[collectAndDownloadAllImagesInContent] No images to download');
  }

  console.log('[collectAndDownloadAllImagesInContent] Completed, returning imageMap with', Object.keys(imageMap).length, 'entries');
  return imageMap;
}

// Handle all articles export from content script
async function handleAllArticlesExportFromContent(exportDelay: number, currentLanguage: string): Promise<void> {
  // Set content language from parameter
  contentLanguage = (currentLanguage === 'en' ? 'en' : 'ja') as SupportedLanguage;

  try {
    // Initialize: clear previous data
    isCancelled = false;
    
    // 1. Get articles from current page (毎回新規取得)
    const extractedData = extractBlogEntries();
    
    // 2. Get pagination info
    const totalPages = getPaginationInfo();
    const isOwnBlog = detectOwnBlog();
    console.log('[handleAllArticlesExportFromContent] isOwnBlog detected as:', isOwnBlog);
    
    // IMPORTANT: No progress reporting until after confirmation dialog
    // This prevents any confusion with image download progress
    
    // 3. Get additional pages if needed
    const allEntries = [...extractedData];
    
    // 最初の進捗表示（1ページ目の結果）
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'pages',
      current: allEntries.length,
      total: totalPages,
      pageInfo: { currentPage: 1, totalPages }
    });
    
    if (totalPages > 1) {
      for (let page = 2; page <= totalPages; page++) {
        // Check for cancellation
        if (isCancelled) {
          return;
        }
        
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0];
        const pageUrl = `${baseUrl}?page=${page}`;
        
        try {
          const additionalEntries = await fetchPageEntries(pageUrl, exportDelay);
          allEntries.push(...additionalEntries);
          
          // Show page collection progress (before confirmation dialog)
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            type: 'pages',
            current: allEntries.length, // 累積記事数
            total: totalPages,
            pageInfo: { currentPage: page, totalPages }
          });
        } catch (error) {
          // Failed to fetch page - continue with available entries
        }
      }
    }

    // Check for cancellation before proceeding
    if (isCancelled) {
      return;
    }

    // 4. Check if there are any articles to export
    const displayCount = allEntries.length;
    console.log('[handleAllArticlesExportFromContent] Found', displayCount, 'articles, isOwnBlog:', isOwnBlog);
    
    if (displayCount === 0) {
      // No articles to export
      sendErrorMessage(msg().noArticlesToExport);
      return;
    }

    // 6. Show confirmation dialog
    chrome.runtime.sendMessage({
      action: 'showExportConfirmation',
      totalArticles: displayCount,
      isOwnBlog
    });

    // 7. Store entries data for confirmation
    chrome.runtime.sendMessage({
      action: 'setAllEntriesData',
      entries: allEntries,
      isOwnBlog,
      exportDelay,
      currentLanguage
    });

  } catch (error) {
    sendErrorMessage(msg().exportProcessError + (error instanceof Error ? error.message : String(error)));
  }
}

// Process all articles after confirmation
async function processAllArticlesFromContent(entries: BlogEntry[], isOwnBlog: boolean, exportDelay: number, currentLanguage: string): Promise<void> {
  // Set content language from parameter
  contentLanguage = (currentLanguage === 'en' ? 'en' : 'ja') as SupportedLanguage;

  try {
    console.log('[EXPORT-LOG] ========== START FULL EXPORT ==========');
    console.log('[EXPORT-LOG] Export configuration:', {
      entriesLength: entries.length,
      isOwnBlog: isOwnBlog,
      exportDelay: exportDelay
    });

    // Initialize: clear previous data
    const allArticles: ArticleDetails[] = [];
    // Remove JSZip initialization - using zip.js streaming instead
    let imageMap: { [key: string]: string } = {};
    const allImageUrls = new Set<string>();

    // Initialize cancellation flag
    isCancelled = false;

    // Phase 0: Download images from image list pages (自分のブログの場合のみ)
    console.log('[EXPORT-LOG] Phase 0: Image list download check (isOwnBlog:', isOwnBlog, ')');
    if (isOwnBlog) {
      console.log('[EXPORT-LOG] Starting Phase 0: Image list download...');
      imageMap = await collectAndDownloadAllImagesInContent(exportDelay);
      console.log('[EXPORT-LOG] Phase 0 completed: Image list download finished with', Object.keys(imageMap).length, 'images');
      
      if (isCancelled) {
        console.log('[EXPORT-LOG] Phase 0 cancelled: Image list download interrupted');
        return;
      }
      console.log('[EXPORT-LOG] Proceeding to Phase 1: Article processing');
    } else {
      console.log('[EXPORT-LOG] Phase 0 skipped: Image list download not needed (not own blog)');
    }

    // Phase 1: Get article details and collect all image URLs
    console.log('[EXPORT-LOG] Starting Phase 1: Processing', entries.length, 'articles');
    for (let i = 0; i < entries.length; i++) {
      // Check for cancellation before each article
      if (isCancelled) {
        console.log('[EXPORT-LOG] Phase 1 cancelled: Article processing interrupted at article', i + 1, '/', entries.length);
        return;
      }
      
      const entry = entries[i];
      
      try {
        console.log(`[EXPORT-LOG] Processing article ${i + 1}/${entries.length}: ${entry.title || 'Unknown Title'}`);
        const articleDetails = await fetchArticleDetails(entry.url, exportDelay);
        allArticles.push(articleDetails);
        
        // Collect all image URLs and log detection
        let articleImageCount = 0;
        if (articleDetails.imageUrls) {
          const newImages = articleDetails.imageUrls.filter((url: string) => !allImageUrls.has(url));
          newImages.forEach((url: string) => allImageUrls.add(url));
          articleImageCount += newImages.length;
          if (newImages.length > 0) {
            console.log(`[EXPORT-LOG] Article ${i + 1}: Detected ${newImages.length} new image URLs in article content`);
          }
        }
        if (articleDetails.thumbnailUrls) {
          const newThumbnails = articleDetails.thumbnailUrls.filter((url: string) => !allImageUrls.has(url));
          newThumbnails.forEach((url: string) => allImageUrls.add(url));
          articleImageCount += newThumbnails.length;
          if (newThumbnails.length > 0) {
            console.log(`[EXPORT-LOG] Article ${i + 1}: Detected ${newThumbnails.length} new thumbnail URLs`);
          }
        }
        
        if (articleImageCount > 0) {
          console.log(`[EXPORT-LOG] Article ${i + 1}: Total ${articleImageCount} new images detected, running total: ${allImageUrls.size} unique images`);
        }

        // Update article details collection progress
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'collecting',
          current: i + 1,
          total: entries.length,
          currentItem: articleDetails.title
        });

      } catch (error) {
        // Failed to fetch article - continue with available articles
      }
    }

    if (isCancelled) {
      return;
    }

    // Phase 2: Download additional images not in image list
    console.log('[EXPORT-LOG] Starting Phase 2: Additional image download from articles');
    const imageUrlsArray = Array.from(allImageUrls);
    const newImageUrls = imageUrlsArray.filter(url => !imageMap[url]); // 画像一覧からダウンロード済みを除外
    console.log('[EXPORT-LOG] Phase 2: Article image analysis complete');
    console.log('[EXPORT-LOG] Phase 2: Total unique images found in articles:', imageUrlsArray.length);
    console.log('[EXPORT-LOG] Phase 2: Already downloaded from image list:', imageUrlsArray.length - newImageUrls.length);
    console.log('[EXPORT-LOG] Phase 2: Additional images to download:', newImageUrls.length);
    
    if (newImageUrls.length > 0) {
      let timeoutId: ReturnType<typeof setTimeout>;
      const downloadedImageData = await Promise.race<DownloadAllImagesResponse>([
        new Promise<DownloadAllImagesResponse>((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'downloadAllImages',
            imageUrls: newImageUrls,
            totalImages: newImageUrls.length
          }, (response: DownloadAllImagesResponse) => {
            clearTimeout(timeoutId); // Clear timeout on success
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        }),
        new Promise<DownloadAllImagesResponse>((_, reject) => {
          timeoutId = setTimeout(() => {
            console.error('[EXPORT-LOG] Phase 2 timeout: Additional image download failed after 2 minutes');
            reject(new Error('Additional image download timeout after 2 minutes'));
          }, 2 * 60 * 1000);
        })
      ]);

      console.log('[EXPORT-LOG] Phase 2 completed: Additional image download finished');
      console.log('[EXPORT-LOG] Phase 2 download response:', downloadedImageData?.success ? 'SUCCESS' : 'FAILED');
      // Create image map without adding to main ZIP (images will be in separate ZIP)
      if (downloadedImageData?.success) {
        console.log('[EXPORT-LOG] Phase 2: Processing', newImageUrls.length, 'additional downloaded images');
        let phase2SuccessCount = 0;
        let phase2FailCount = 0;
        
        for (let i = 0; i < newImageUrls.length; i++) {
          const imageUrl = newImageUrls[i];
          if (isCancelled) break;

          const imageResponse = await new Promise<GetDownloadedImageResponse>((resolve) => {
            chrome.runtime.sendMessage({
              action: 'getDownloadedImage',
              imageUrl: imageUrl
            }, resolve);
          });
          
          if (imageResponse?.success && imageResponse.imageData) {
            const imageData = imageResponse.imageData;
            if (imageData.success && imageData.base64) {
              const imagePath = `images/${imageData.filename}`;
              // Only update imageMap, don't add to main ZIP
              imageMap[imageData.url] = imagePath;
              phase2SuccessCount++;
            } else {
              imageMap[imageData.url] = imageData.url;
              phase2FailCount++;
            }
          } else {
            imageMap[imageUrl] = imageUrl;
            phase2FailCount++;
          }
        }
        
        console.log('[EXPORT-LOG] Phase 2: Image processing complete -', phase2SuccessCount, 'success,', phase2FailCount, 'failed');
        console.log('[EXPORT-LOG] Phase 2: Total images in imageMap:', Object.keys(imageMap).length);
      }
    }

    // Final cancellation check before ZIP creation
    if (isCancelled) {
      return;
    }

    // Phase 3: Convert articles to markdown and prepare for unified ZIP creation
    console.log('[EXPORT-LOG] Starting Phase 3: Converting articles to Markdown for unified ZIP creation');
    console.log('[EXPORT-LOG] Phase 3: Processing', allArticles.length, 'articles with', Object.keys(imageMap).length, 'total images');
    const articleListMarkdown: string[] = [];
    const processedArticles: Array<{sanitizedTitle: string, markdownContent: string}> = [];
    
    for (let i = 0; i < allArticles.length; i++) {
      if (isCancelled) return;
      
      const article = allArticles[i];

      // Skip articles with missing title or body
      if (!article.title || !article.bodyHtml) {
        console.warn(`[EXPORT-LOG] Skipping article ${i + 1}: missing title or body`);
        continue;
      }

      try {
        const markdownResult = processImagesAndConvertToMarkdown({
          title: article.title,
          htmlContent: article.bodyHtml,
          likes: article.likes,
          commentsCount: article.commentsCount,
          publishDate: article.publishDate,
          tags: article.tags,
          imageMap,
          thumbnailUrls: article.thumbnailUrls,
          commentsData: article.commentsData
        });

        if (markdownResult.success && markdownResult.markdown) {
          const sanitizedTitle = sanitizeFilename(article.title);
          
          // Store processed article for zip.js streaming
          processedArticles.push({
            sanitizedTitle,
            markdownContent: markdownResult.markdown
          });
          
          // Use actual filename with ID prefix for index links
          const actualFilename = `${String(i + 1).padStart(3, '0')}_${sanitizedTitle}.md`;
          articleListMarkdown.push(`- [${article.title}](${actualFilename})`);
        }

        // Update article processing progress
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'articles',
          current: i + 1,
          total: allArticles.length,
          currentItem: article.title
        });

      } catch (error) {
        console.error(`Error processing article: ${article.title}`, error);
      }
    }

    // Create unified ZIP with articles and images using zip.js streaming
    console.log('[STREAMING-ZIP] ========== START UNIFIED ZIP CREATION ==========');
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter());
    
    // Add all articles to ZIP
    console.log('[STREAMING-ZIP] Adding articles to ZIP...');
    for (let i = 0; i < processedArticles.length; i++) {
      const article = processedArticles[i];
      const articleFilename = `${String(i + 1).padStart(3, '0')}_${article.sanitizedTitle}.md`;
      
      console.log(`[STREAMING-ZIP] Adding article ${i + 1}/${processedArticles.length}: ${articleFilename}`);
      await zipWriter.add(articleFilename, new zip.TextReader(article.markdownContent));
    }
    
    // Add article index
    const articleListContent = `# Articles Index\n\n${articleListMarkdown.join('\n')}`;
    console.log('[STREAMING-ZIP] Adding article index...');
    await zipWriter.add('index.md', new zip.TextReader(articleListContent));
    
    // Add all images to ZIP using streaming
    const imageUrls = Object.keys(imageMap).filter(url => imageMap[url].startsWith('images/'));
    console.log('[STREAMING-ZIP] Total imageMap entries:', Object.keys(imageMap).length);
    console.log('[STREAMING-ZIP] Image URLs for ZIP creation:', imageUrls.length);
    console.log('[STREAMING-ZIP] Sample image URLs (first 5):', imageUrls.slice(0, 5));
    
    if (imageUrls.length > 0) {
      let zipSuccessCount = 0;
      let zipFailCount = 0;
      const zipFailedUrls: string[] = [];
      
      console.log('[STREAMING-ZIP] Starting to add images to ZIP...');
      
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        if (isCancelled) {
          console.log('[STREAMING-ZIP] Cancelled during ZIP creation at', i + 1, '/', imageUrls.length);
          break;
        }
        
        console.log(`[STREAMING-ZIP] Adding image ${i + 1}/${imageUrls.length} to ZIP: ${extractFilenameFromUrl(imageUrl)}`);

        const imageResponse = await new Promise<GetDownloadedImageResponse>((resolve) => {
          chrome.runtime.sendMessage({
            action: 'getDownloadedImage',
            imageUrl: imageUrl
          }, resolve);
        });
        
        console.log(`[STREAMING-ZIP] Image ${i + 1} response:`, {
          success: imageResponse?.success,
          hasImageData: !!imageResponse?.imageData,
          hasBase64: !!imageResponse?.imageData?.base64,
          base64Length: imageResponse?.imageData?.base64?.length,
          filename: imageResponse?.imageData?.filename
        });
        
        if (imageResponse?.success && imageResponse.imageData?.base64) {
          const imagePath = imageMap[imageUrl];
          
          try {
            // Convert base64 to Uint8Array for zip.js
            const imageBytes = base64ToUint8Array(imageResponse.imageData.base64);
            await zipWriter.add(imagePath, new zip.Uint8ArrayReader(imageBytes));
            
            zipSuccessCount++;
            console.log(`[STREAMING-ZIP] Successfully added image ${i + 1} to ZIP: ${imagePath} (${Math.round(imageBytes.length/1024)}KB)`);
          } catch (error) {
            zipFailCount++;
            zipFailedUrls.push(imageUrl);
            console.error(`[STREAMING-ZIP] Failed to add image ${i + 1} to ZIP:`, error);
          }
        } else {
          zipFailCount++;
          zipFailedUrls.push(imageUrl);
          console.log(`[STREAMING-ZIP] Skipping image ${i + 1} - no valid data`);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[STREAMING-ZIP] ZIP progress: ${i + 1}/${imageUrls.length} (${Math.round((i+1)/imageUrls.length*100)}%)`);
          console.log(`[STREAMING-ZIP] Added to ZIP: ${zipSuccessCount}, Failed: ${zipFailCount}`);
        }
      }
      
      console.log('[STREAMING-ZIP] ========== IMAGE ADDITION COMPLETE ==========');
      console.log(`[STREAMING-ZIP] Total images to add: ${imageUrls.length}`);
      console.log(`[STREAMING-ZIP] Successfully added to ZIP: ${zipSuccessCount}`);
      console.log(`[STREAMING-ZIP] Failed to add to ZIP: ${zipFailCount}`);
      console.log(`[STREAMING-ZIP] ZIP success rate: ${Math.round(zipSuccessCount/imageUrls.length*100)}%`);
      
      if (zipFailedUrls.length > 0) {
        console.log('[STREAMING-ZIP] Failed ZIP URLs (first 10):', zipFailedUrls.slice(0, 10));
      }
    } else {
      console.log('[STREAMING-ZIP] No images to add to ZIP');
    }
    
    // Generate final ZIP blob
    console.log('[STREAMING-ZIP] Generating final ZIP blob...');
    const zipBlob = await zipWriter.close();
    
    // Download unified ZIP
    const filename = isOwnBlog ? 'lodestone_complete_export.zip' : 'lodestone_others_complete_export.zip';
    await downloadZip(zipBlob, filename);

    // Notify completion
    console.log('[EXPORT-LOG] ========== FULL EXPORT COMPLETE ==========');
    console.log('[EXPORT-LOG] Export summary: All phases completed successfully');
    chrome.runtime.sendMessage({ action: 'exportComplete' });
    
    // Delete entire database after successful export
    try {
      await deleteDatabase();
      console.log('[Content] IndexedDB database deleted after successful export');
    } catch (error) {
      console.error('[Content] Failed to delete IndexedDB after export:', error);
    }

  } catch (error) {
    sendErrorMessage(msg().articleProcessError + (error instanceof Error ? error.message : String(error)));
    
    // Delete database even on error
    try {
      await deleteDatabase();
      console.log('[Content] IndexedDB database deleted after error');
    } catch (clearError) {
      console.error('[Content] Failed to delete IndexedDB after error:', clearError);
    }
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request: ContentScriptMessage, _sender: chrome.runtime.MessageSender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  switch (request.action) {
    case 'scrapeAdditionalPage':
      try {
        const extractedData = extractBlogEntries();
        sendResponse({ success: true, data: extractedData, articleCount: extractedData.length });
      } catch (error) {
        sendResponse({ success: false, message: `Failed to scrape page: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;
      
    case 'getSingleArticleData':
      try {
        const articleDetails = extractArticleDetails();
        
        if (articleDetails.title && articleDetails.bodyHtml) {
          sendResponse({
            success: true,
            ...articleDetails
          });
        } else {
          sendResponse({ success: false, message: 'Article details not found.' });
        }
      } catch (error) {
        sendResponse({ success: false, message: `Failed to extract article details: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;
      
    case 'showExportNotification':
      showExportNotification(request.message);
      sendResponse({ success: true });
      break;
      
    case 'exportSingleArticle':
      handleSingleArticleExportInContent(sendResponse);
      return true; // 非同期処理のため
      
    case 'exportAllArticlesFromContent':
      handleAllArticlesExportFromContent(request.exportDelay, request.currentLanguage);
      sendResponse({ success: true });
      break;
      
    case 'processAllArticlesFromContent':
      processAllArticlesFromContent(request.entries, request.isOwnBlog, request.exportDelay, request.currentLanguage);
      sendResponse({ success: true });
      break;
      
    case 'cancelExport':
      isCancelled = true;
      sendResponse({ success: true });
      break;
      
    case 'scrapeImageListPage':
      try {
        console.log('[Content Script] scrapeImageListPage called, current URL:', window.location.href);
        const imageUrls = scrapeImageListPageUrls();
        const totalPages = getImageListTotalPages();
        console.log('[Content Script] scrapeImageListPage results:', {
          imageUrls: imageUrls.length,
          totalPages: totalPages,
          currentPageText: document.querySelector('.btn__pager__current')?.textContent
        });
        sendResponse({ success: true, imageUrls, totalPages });
      } catch (error) {
        console.error('[Content Script] scrapeImageListPage error:', error);
        sendResponse({ success: false, message: `Failed to scrape image list: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;

    case 'getArticleInfo':
      try {
        const articleInfo = extractArticleDetails();
        sendResponse({
          success: true,
          title: articleInfo.title || undefined,
          bodyLength: articleInfo.bodyHtml?.length || 0,
          imageCount: articleInfo.imageUrls.length + articleInfo.thumbnailUrls.length,
          likes: articleInfo.likes,
          commentsCount: articleInfo.commentsCount
        });
      } catch (error) {
        sendResponse({ success: false, message: `Failed to get article info: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;

    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }

  return false; // Most operations are sync
});