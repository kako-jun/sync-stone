// Content script for SyncStone Chrome extension

// TurndownService is loaded from popup.html
declare const TurndownService: any;
const turndownService = new TurndownService();

// JSZip import for content script
import JSZip from 'jszip';

// Global cancellation flag
let isCancelled = false;

// CSS selectors
const SELECTORS = {
  BLOG_ENTRIES: 'li.entry__blog',
  BLOG_LINK: 'a.entry__blog__link',
  BLOG_TITLE: 'h2.entry__blog__title',
  BLOG_TIME: 'time span',
  BLOG_TAGS: 'div.entry__blog__tag ul li',
  BLOG_THUMBNAIL: 'div.entry__blog__img__inner img',
  PAGINATION: '.btn__pager__current',
  ARTICLE_BODY: 'div.txt_selfintroduction',
  ARTICLE_LIKES: '.blog__area__like__text__zero, .js__like_count',
  ARTICLE_COMMENTS_COUNT: '.entry__blog__header__comment span',
  ARTICLE_PUBLISH_DATE: '.entry__blog__header time span, time[datetime]',
  ARTICLE_TAGS_CONTAINER: '.entry__blog__tag ul li a',
  THUMBNAIL_LIST: '.thumb_list img',
  COMMENT_BODIES: '.thread__comment__body',
  COMMENT_AUTHOR: '.entry__name',
  COMMENT_TIMESTAMP: '.entry__time--comment'
};

// Helper function to extract blog entries
function extractBlogEntries(): any[] {
  const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
  const extractedData: any[] = [];

  blogEntries.forEach(entry => {
    const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
    const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
    const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
    const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
    const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

    const url = urlElement?.href || '';
    const title = titleElement?.innerText.trim() || '';
    const date = timeElement?.innerText.trim() || '';
    const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());
    const thumbnail = thumbnailElement?.src || null;

    extractedData.push({ url, title, date, tags, thumbnail });
  });

  return extractedData;
}

// Helper function to get pagination info
function getPaginationInfo(): number {
  let totalPages = 1;
  const paginationElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
  if (paginationElement) {
    const paginationText = paginationElement.innerText;
    const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
    if (match?.[2]) {
      totalPages = parseInt(match[2], 10);
    }
  }
  return totalPages;
}

// Helper function to extract article details
function extractArticleDetails(): any {
  const titleElement = document.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
  const bodyElement = document.querySelector(SELECTORS.ARTICLE_BODY) as HTMLElement;
  const likesElement = document.querySelector(SELECTORS.ARTICLE_LIKES) as HTMLElement;
  const commentsCountElement = document.querySelector(SELECTORS.ARTICLE_COMMENTS_COUNT) as HTMLElement;
  const publishDateElement = document.querySelector(SELECTORS.ARTICLE_PUBLISH_DATE);
  const tagsElements = document.querySelectorAll(SELECTORS.ARTICLE_TAGS_CONTAINER);

  const title = titleElement?.innerText.trim() || null;
  const bodyHtml = bodyElement?.innerHTML || null;
  const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
  const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
  const publishDate = publishDateElement ? 
    (publishDateElement.getAttribute('datetime') || (publishDateElement as HTMLElement).innerText.trim()) : null;
  const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());

  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];

  // Extract thumbnail images（過去の動作していたコードと同じ）
  const thumbnailElements = document.querySelectorAll('.thumb_list img');
  thumbnailElements.forEach(img => {
    const thumbnailImg = img as HTMLImageElement;
    const originalSrc = thumbnailImg.getAttribute('data-origin_src');
    if (originalSrc) {
      thumbnailUrls.push(originalSrc);
      imageUrls.push(originalSrc);
    }
  });

  // Extract images from article body
  if (bodyHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyHtml, 'text/html');
    
    // Extract all img tags with data-origin_src (external images)
    const imgElements = doc.querySelectorAll('img[data-origin_src]');
    imgElements.forEach(img => {
      const originalSrc = img.getAttribute('data-origin_src');
      if (originalSrc && !imageUrls.includes(originalSrc)) {
        imageUrls.push(originalSrc);
      }
    });
    
    // Extract regular img tags without data-origin_src (internal images)
    const regularImgElements = doc.querySelectorAll('img:not([data-origin_src])');
    regularImgElements.forEach(img => {
      const imgElement = img as HTMLImageElement;
      if (imgElement.src && !imageUrls.includes(imgElement.src)) {
        imageUrls.push(imgElement.src);
      }
    });
  }

  // Extract comments
  const commentsData: any[] = [];
  const commentBodies = document.querySelectorAll(SELECTORS.COMMENT_BODIES);

  commentBodies.forEach(bodyElement => {
    const entryElement = bodyElement.previousElementSibling;
    if (entryElement?.classList.contains('entry')) {
      const authorElement = entryElement.querySelector(SELECTORS.COMMENT_AUTHOR) as HTMLElement;
      const timestampElement = entryElement.querySelector(SELECTORS.COMMENT_TIMESTAMP) as HTMLElement;

      if (authorElement && bodyElement) {
        commentsData.push({
          author: authorElement.innerText.trim(),
          timestamp: timestampElement?.innerText.trim() || '',
          commentBodyHtml: (bodyElement as HTMLElement).innerHTML
        });
      }
    }
  });

  return {
    title,
    bodyHtml,
    likes,
    commentsCount,
    publishDate,
    tags,
    imageUrls,
    thumbnailUrls,
    commentsData
  };
}

// Helper function to detect if it's own blog
function detectOwnBlog(): boolean {
  // 1. GTM variable check (most reliable)
  if (typeof window !== 'undefined' && (window as any).ldst_gtm_variable) {
    const gtmVariable = (window as any).ldst_gtm_variable;
    if (gtmVariable.mychara === 'notmychara') {
      return false;
    }
    if (gtmVariable.mychara === 'mychara') {
      return true;
    }
  }
  
  // 2. DOM element check
  const createBlogButton = document.querySelector('a[href*="/blog/add"]');
  const editButton = document.querySelector('a[href*="/blog/edit"]');
  
  if (createBlogButton || editButton) {
    return true;
  }
  
  const othersViewElement = document.querySelector('.entry__blog__view--others');
  if (othersViewElement) {
    return false;
  }
  
  // 3. URL pattern check
  const currentUrl = window.location.href;
  if (currentUrl.includes('/lodestone/my/')) {
    return true;
  }
  
  // 4. Default to own blog
  return true;
}

// Show export notification banner
function showExportNotification(message: string): void {
  // Remove existing notification if any
  const existingNotification = document.getElementById('sync-stone-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification banner
  const notification = document.createElement('div');
  notification.id = 'sync-stone-notification';
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideDown 0.5s ease-out;
    border-bottom: 3px solid #ffd700;
  `;

  // Add animation CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    #sync-stone-notification {
      animation: slideDown 0.5s ease-out, pulse 2s infinite 1s;
    }
  `;
  document.head.appendChild(style);

  // Create notification content without innerHTML
  const notificationContent = document.createElement('div');
  notificationContent.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px;';
  
  const leftIcon = document.createElement('span');
  leftIcon.style.fontSize = '20px';
  leftIcon.textContent = '📋';
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  
  const rightIcon = document.createElement('span');
  rightIcon.style.fontSize = '20px';
  rightIcon.textContent = '📥';
  
  notificationContent.appendChild(leftIcon);
  notificationContent.appendChild(messageSpan);
  notificationContent.appendChild(rightIcon);
  notification.appendChild(notificationContent);

  // Click to dismiss
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideDown 0.3s ease-in reverse';
    setTimeout(() => notification.remove(), 300);
  });

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideDown 0.3s ease-in reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);

  document.body.insertBefore(notification, document.body.firstChild);
}

// Fetch page entries via background script
async function fetchPageEntries(pageUrl: string, delay: number): Promise<any[]> {
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
async function fetchArticleDetails(articleUrl: string, delay: number): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'fetchArticleInNewTab',
      url: articleUrl,
      delay
    }, (response) => {
      if (response?.success) {
        resolve(response.article);
      } else {
        reject(new Error(response?.message || 'Failed to fetch article details'));
      }
    });
  });
}

// Send error message
function sendErrorMessage(message: string): void {
  chrome.runtime.sendMessage({
    action: 'showError',
    message
  });
}

// Helper functions for content script
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function sanitizeFilename(filename: string, maxLength = 50): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, maxLength);
}

// Download ZIP using <a> tag download
function downloadZip(zip: JSZip, filename: string): Promise<void> {
  return new Promise(async (resolve) => {
    const content = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const dataUrl = 'data:application/zip;base64,' + content;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    resolve();
  });
}

// Handle single article export in content script
async function handleSingleArticleExportInContent(sendResponse: (response: any) => void): Promise<void> {
  try {
    // Get article data
    const articleDetails = extractArticleDetails();
    
    if (!articleDetails.title || !articleDetails.bodyHtml) {
      throw new Error('記事データを取得できませんでした');
    }
    
    const zip = new JSZip();
    const imageMap: { [key: string]: string } = {};

    // Download images via background script (remove duplicates)
    const imageUrlsSet = new Set([...(articleDetails.imageUrls || []), ...(articleDetails.thumbnailUrls || [])]);
    const allImageUrls = Array.from(imageUrlsSet);
    
    if (allImageUrls.length > 0) {
      const downloadedImageData: any = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'downloadAllImages',
          imageUrls: allImageUrls,
          totalImages: allImageUrls.length
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      // Add downloaded images to ZIP and create image map
      if (downloadedImageData?.success && downloadedImageData.images) {
        for (const imageData of downloadedImageData.images) {
          if (imageData.success && imageData.base64) {
            const imagePath = `images/${imageData.filename}`;
            // Convert base64 to blob for JSZip
            const base64Data = imageData.base64.split(',')[1]; // Remove data:image/...;base64, prefix
            zip.file(imagePath, base64Data, { base64: true });
            imageMap[imageData.url] = imagePath;
          } else {
            imageMap[imageData.url] = imageData.url;
          }
        }
      }
    }

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
      throw new Error('Markdownへの変換に失敗しました');
    }

    // Create ZIP file
    const sanitizedTitle = sanitizeFilename(articleDetails.title);
    zip.file(`${sanitizedTitle}.md`, markdownResult.markdown);

    await downloadZip(zip, `${sanitizedTitle}.zip`);

    sendResponse({ success: true, message: '記事がエクスポートされました！' });
  } catch (error) {
    sendResponse({ 
      success: false, 
      message: 'エクスポートに失敗しました: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

// Collect and download all images from image list pages
async function collectAndDownloadAllImagesInContent(exportDelay: number): Promise<{ [key: string]: string }> {
  const allImageUrls = new Set<string>();
  let currentPage = 1;
  let totalPages = 1;
  const imageMap: { [key: string]: string } = {};

  // 画像一覧ページから画像URLを収集
  while (currentPage <= totalPages) {
    if (isCancelled) {
      break;
    }
    
    const imageUrlListPage = `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${currentPage}`;
    
    try {
      // バックグラウンドにタブ作成を依頼
      const response: any = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'fetchImageListPage',
          url: imageUrlListPage,
          delay: exportDelay
        }, resolve);
      });
      
      if (response?.success && response.imageUrls) {
        response.imageUrls.forEach((url: string) => allImageUrls.add(url));
        if (currentPage === 1) {
          totalPages = response.totalPages || 1;
        }
      }
    } catch (error) {
      console.error(`Failed to scrape image list page: ${imageUrlListPage}`, error);
    }
    
    currentPage++;
  }

  if (isCancelled) {
    return {};
  }

  // 収集した画像をBackground Scriptでダウンロード
  const imageUrlsArray = Array.from(allImageUrls);
  
  if (imageUrlsArray.length > 0) {
    const downloadedImageData: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'downloadAllImages',
        imageUrls: imageUrlsArray,
        totalImages: imageUrlsArray.length
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    // ダウンロード結果からimageMapを作成
    if (downloadedImageData?.success && downloadedImageData.images) {
      for (const imageData of downloadedImageData.images) {
        if (isCancelled) break;
        
        if (imageData.success && imageData.base64) {
          const imagePath = `images/${imageData.filename}`;
          imageMap[imageData.url] = imagePath;
        } else {
          imageMap[imageData.url] = imageData.url;
        }
      }
    }
  }

  return imageMap;
}

// Handle all articles export from content script
async function handleAllArticlesExportFromContent(exportDelay: number, isDeveloperMode: boolean, currentLanguage: string): Promise<void> {
  try {
    // Reset cancellation flag
    isCancelled = false;
    
    // 1. Get articles from current page
    const extractedData = extractBlogEntries();
    
    // 2. Get pagination info
    const totalPages = getPaginationInfo();
    const isOwnBlog = detectOwnBlog();
    
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

    // 4. Apply developer mode limit
    let processEntries = allEntries;
    if (isDeveloperMode && allEntries.length > 5) {
      processEntries = allEntries.slice(0, 5);
    }

    // 5. Show confirmation dialog
    const displayCount = processEntries.length;
    chrome.runtime.sendMessage({
      action: 'showExportConfirmation',
      totalArticles: displayCount,
      isOwnBlog
    });

    // 6. Store entries data for confirmation
    chrome.runtime.sendMessage({
      action: 'setAllEntriesData',
      entries: processEntries,
      isOwnBlog,
      exportDelay,
      isDeveloperMode,
      currentLanguage
    });

  } catch (error) {
    sendErrorMessage('エクスポート処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Process all articles after confirmation
async function processAllArticlesFromContent(entries: any[], isOwnBlog: boolean, exportDelay: number, currentLanguage: string): Promise<void> {
  try {
    const allArticles: any[] = [];
    const zip = new JSZip();
    const imageMap: { [key: string]: string } = {};
    const allImageUrls = new Set<string>();

    // Phase 1: Get article details and collect all image URLs
    for (let i = 0; i < entries.length; i++) {
      // Check for cancellation before each article
      if (isCancelled) {
        return;
      }
      
      const entry = entries[i];
      
      try {
        const articleDetails = await fetchArticleDetails(entry.url, exportDelay);
        allArticles.push(articleDetails);
        
        // Collect all image URLs
        if (articleDetails.imageUrls) {
          articleDetails.imageUrls.forEach((url: string) => allImageUrls.add(url));
        }
        if (articleDetails.thumbnailUrls) {
          articleDetails.thumbnailUrls.forEach((url: string) => allImageUrls.add(url));
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

    // Phase 2: Request background script to download all images
    const imageUrlsArray = Array.from(allImageUrls);
    const downloadedImageData: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'downloadAllImages',
        imageUrls: imageUrlsArray,
        totalImages: imageUrlsArray.length
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    // Add downloaded images to ZIP and create image map
    if (downloadedImageData?.success && downloadedImageData.images) {
      for (const imageData of downloadedImageData.images) {
        if (isCancelled) break;
        
        if (imageData.success && imageData.base64) {
          const imagePath = `images/${imageData.filename}`;
          // Convert base64 to blob for JSZip
          const base64Data = imageData.base64.split(',')[1]; // Remove data:image/...;base64, prefix
          zip.file(imagePath, base64Data, { base64: true });
          imageMap[imageData.url] = imagePath;
        } else {
          imageMap[imageData.url] = imageData.url;
        }
      }
    }

    // Final cancellation check before ZIP creation
    if (isCancelled) {
      return;
    }

    // Phase 3: Convert articles to markdown and create final ZIP
    const articleListMarkdown: string[] = [];
    
    for (let i = 0; i < allArticles.length; i++) {
      if (isCancelled) return;
      
      const article = allArticles[i];
      
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
          const filename = `${sanitizedTitle}.md`;
          
          zip.file(filename, markdownResult.markdown);
          articleListMarkdown.push(`- [${article.title}](${filename})`);
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

    // Add article index
    const articleListContent = `# Articles Index\n\n${articleListMarkdown.join('\n')}`;
    zip.file('index.md', articleListContent);

    // Download ZIP
    const filename = isOwnBlog ? 'lodestone_blog_export.zip' : 'lodestone_others_blog_export.zip';
    await downloadZip(zip, filename);

    // Notify completion
    chrome.runtime.sendMessage({ action: 'exportComplete' });

  } catch (error) {
    sendErrorMessage('記事処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
  }
}

// Scrape image URLs from image list page
function scrapeImageListPageUrls(): string[] {
  const imageUrls: string[] = [];
  
  // ロドストの画像一覧ページのセレクタ（動作していたJS版と同じ）
  const imageElements = document.querySelectorAll('.image__list img');
  
  imageElements.forEach(img => {
    const imageElement = img as HTMLImageElement;
    
    // サムネイル画像ではなく、元の画像URLを取得する
    // ロドストの画像一覧ページでは、img.srcがサムネイルURLになっている場合があるため、親要素のaタグのhrefを見る
    const parentLink = imageElement.closest('a.fancybox_element') as HTMLAnchorElement;
    if (parentLink && parentLink.href) {
      imageUrls.push(parentLink.href);
    } else {
      imageUrls.push(imageElement.src); // フォールバック
    }
  });
  
  return imageUrls;
}

// Get total pages from image list pagination
function getImageListTotalPages(): number {
  let totalPages = 1;
  
  // 動作していたJS版と同じページネーション取得
  const totalPagesElement = document.querySelector('.btn__pager__current');
  if (totalPagesElement) {
    const match = totalPagesElement.textContent?.match(/\/ (\d+)ページ/);
    if (match && match[1]) {
      totalPages = parseInt(match[1], 10);
    }
  }
  
  return totalPages;
}

// Convert HTML to Markdown with image replacement
function processImagesAndConvertToMarkdown(data: any): { success: boolean; markdown?: string; message?: string } {
  try {
    const { title, htmlContent, likes, commentsCount, publishDate, tags, imageMap, thumbnailUrls, commentsData } = data;

    // Configure Turndown with image replacement rule
    turndownService.addRule('image', {
      filter: 'img',
      replacement: function (_content: string, node: any) {
        const originalSrc = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        const newSrc = imageMap[originalSrc] || originalSrc;
        return `![${alt}](${newSrc})`;
      }
    });

    // Build markdown with YAML frontmatter
    let markdown = `---\n`;
    markdown += `title: "${title.replace(/"/g, '\\"')}"\n`;
    if (publishDate) {
      markdown += `date: "${publishDate}"\n`;
    }
    markdown += `likes: ${likes}\n`;
    markdown += `comments: ${commentsCount}\n`;
    if (tags && tags.length > 0) {
      markdown += `tags:\n`;
      tags.forEach((tag: string) => {
        markdown += `  - ${tag}\n`;
      });
    }
    markdown += `---\n\n`;

    // Add thumbnail images first
    if (thumbnailUrls && thumbnailUrls.length > 0) {
      thumbnailUrls.forEach((thumbnailUrl: string) => {
        const localPath = imageMap[thumbnailUrl] || thumbnailUrl;
        markdown += `![](${localPath})\n\n`;
      });
    }

    // Convert HTML to markdown
    markdown += turndownService.turndown(htmlContent);

    // Add comments section
    if (commentsData && commentsData.length > 0) {
      markdown += '\n\n## Comments\n\n';
      commentsData.forEach((comment: any) => {
        markdown += `### ${comment.author} (${comment.timestamp})\n\n`;
        markdown += turndownService.turndown(comment.commentBodyHtml);
        markdown += '\n\n---\n\n';
      });
    }

    return { success: true, markdown };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to convert to markdown: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
  
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
      
    case 'processImagesAndConvertToMarkdown':
      const result = processImagesAndConvertToMarkdown(request);
      sendResponse(result);
      break;
      
    case 'showExportNotification':
      showExportNotification(request.message);
      sendResponse({ success: true });
      break;
      
    case 'exportSingleArticle':
      handleSingleArticleExportInContent(sendResponse);
      return true; // 非同期処理のため
      
    case 'exportAllArticlesFromContent':
      handleAllArticlesExportFromContent(request.exportDelay, request.isDeveloperMode, request.currentLanguage);
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
        const imageUrls = scrapeImageListPageUrls();
        const totalPages = getImageListTotalPages();
        sendResponse({ success: true, imageUrls, totalPages });
      } catch (error) {
        sendResponse({ success: false, message: `Failed to scrape image list: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;
      
    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }

  return false; // Most operations are sync
});