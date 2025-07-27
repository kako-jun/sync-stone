import JSZip from 'jszip';
import { BlogEntry, ExportState, ImageMap } from '@/types';
import { CONFIG, URLS } from '@/utils/constants';
import { sanitizeFilename } from '@/utils/helpers';
import { ImageProcessor } from '@/services/ImageProcessor';

// Global state
let exportState: ExportState = {
  isExporting: false,
  showingConfirmation: false,
  showingProgress: false,
  type: 'articles',
  current: 0,
  total: 0
};

let isCancelled = false;
let currentExportDelay = CONFIG.DEFAULT_EXPORT_DELAY;
let isDeveloperMode = false;
let currentLanguage = 'ja';

// Stored entries data for content script approach
let storedEntriesData: {
  entries: BlogEntry[];
  isOwnBlog: boolean;
  exportDelay: number;
  isDeveloperMode: boolean;
  currentLanguage: string;
} | null = null;

// Background script messages
const backgroundMessages: { [key: string]: { [key: string]: string } } = {
  ja: {
    contentScriptNotAvailable: 'ページをリロードしてから再度お試しください。',
    couldNotRetrieveData: '記事データを取得できませんでした。',
    notOnBlogListPageError: 'ブログ一覧ページではありません。',
    singleArticleExported: '記事がエクスポートされました！',
    exportComplete: 'エクスポート完了！',
    failedToExport: 'エクスポートに失敗しました: ',
    failedToDownloadImages: '画像のダウンロードに失敗しました: ',
    blogListMoved: 'ブログ一覧ページに移動しました。全記事エクスポートボタンをもう一度押してください。',
    exportDataNotFound: 'エクスポート用のデータが見つかりません'
  },
  en: {
    contentScriptNotAvailable: 'Please reload the page and try again.',
    couldNotRetrieveData: 'Could not retrieve article data from page.',
    notOnBlogListPageError: 'Not on blog list page.',
    singleArticleExported: 'Single article exported successfully!',
    exportComplete: 'Export complete!',
    failedToExport: 'Failed to export: ',
    failedToDownloadImages: 'Failed to download images: ',
    blogListMoved: 'Moved to blog list page. Please press the export all articles button again.',
    exportDataNotFound: 'Export data not found'
  }
};

// Get message in current language
function getMessage(key: string): string {
  return backgroundMessages[currentLanguage][key] || backgroundMessages.ja[key];
}

// Browser action click handler
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url) return;
  
  const hasLodestone = tab.url.includes('lodestone');
  const hasBlog = tab.url.includes('/blog/');
  
  if (hasLodestone && hasBlog && !tab.url.includes('/blog/?')) {
    // Individual article page - open blog list
    navigateToBlogListFirstPage();
  } else if (hasLodestone && hasBlog && tab.url.includes('/blog/?')) {
    // Blog list page - show popup
    chrome.action.setPopup({ popup: 'popup.html' });
    chrome.action.openPopup();
  } else {
    sendErrorMessage(getMessage('notOnBlogListPageError'));
  }
});

// Navigate to blog list first page
function navigateToBlogListFirstPage(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;

    const characterMatch = tab.url.match(/\/lodestone\/character\/(\d+)\//);
    if (characterMatch) {
      const characterId = characterMatch[1];
      const blogListUrl = URLS.BLOG_LIST_PAGE(characterId);
      
      chrome.tabs.create({ url: blogListUrl, active: true }, (newTab) => {
        setTimeout(() => {
          if (newTab.id) {
            chrome.tabs.sendMessage(newTab.id, {
              action: 'showExportNotification',
              message: getMessage('blogListMoved')
            });
          }
        }, currentExportDelay);
      });
    } else {
      sendErrorMessage(getMessage('notOnBlogListPageError'));
    }
  });
}

// Message handler
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.action) {
    case 'getExportState':
      sendResponse(exportState);
      break;
      
    case 'setExportDelay':
      currentExportDelay = Math.max(request.delay || CONFIG.DEFAULT_EXPORT_DELAY, CONFIG.MIN_EXPORT_DELAY);
      isDeveloperMode = request.developerMode || false;
      currentLanguage = request.language || 'ja';
      sendResponse({ success: true });
      break;
      
    case 'exportSingleArticle':
      handleSingleArticleExport();
      break;
      
    case 'exportAllArticles':
      handleExportAllArticles();
      break;
      
    case 'confirmExportAll':
      if (storedEntriesData) {
        handleConfirmExportAllFromContent();
      }
      break;
      
    case 'downloadImages':
      handleImageDownload();
      sendResponse({ success: true });
      break;
      
    case 'cancelExport':
      handleCancelExport();
      sendResponse({ success: true });
      break;
      
    case 'fetchPageInNewTab':
      handleFetchPageInNewTab(request.url, request.delay, sendResponse);
      return true; // Will respond asynchronously
      
    case 'fetchArticleInNewTab':
      handleFetchArticleInNewTab(request.url, request.delay, sendResponse);
      return true; // Will respond asynchronously
      
    case 'setAllEntriesData':
      storedEntriesData = {
        entries: request.entries,
        isOwnBlog: request.isOwnBlog,
        exportDelay: request.exportDelay,
        isDeveloperMode: request.isDeveloperMode,
        currentLanguage: request.currentLanguage
      };
      sendResponse({ success: true });
      break;
      
    case 'createFinalZip':
      handleCreateFinalZip(request.articles, request.imageUrls, request.isOwnBlog, request.currentLanguage);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }
  
  // Only return true for async operations that are already handled above
  return false;
});

// Handle export all articles
function handleExportAllArticles(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url || !tab?.id) return;
    
    const currentUrl = tab.url;
    const isBlogListFirstPage = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/) && 
                                (!currentUrl.includes('page=') || currentUrl.includes('page=1'));
    
    if (isBlogListFirstPage) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'exportAllArticlesFromContent',
        exportDelay: currentExportDelay,
        isDeveloperMode,
        currentLanguage
      }).catch(() => {
        sendErrorMessage(getMessage('contentScriptNotAvailable'));
      });
    } else {
      navigateToBlogListFirstPage();
    }
  });
}

// Handle single article export
async function handleSingleArticleExport(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) return;

    // Get article data from content script
    const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSingleArticleData' });
    
    if (!response?.success) {
      throw new Error(getMessage('couldNotRetrieveData'));
    }
    
    const zip = new JSZip();
    const imageProcessor = new ImageProcessor(zip, currentExportDelay);

    // Download images
    const allImageUrls = [...(response.imageUrls || []), ...(response.thumbnailUrls || [])];
    const imageMap = await imageProcessor.downloadImages(allImageUrls, (current, total, pageInfo, currentItem) => {
      // 個別記事なので進捗表示は行わない
    }, () => isCancelled);

    // Convert to markdown using content script
    const markdownResponse = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'processImagesAndConvertToMarkdown',
      title: response.title,
      htmlContent: response.bodyHtml,
      likes: response.likes,
      commentsCount: response.commentsCount,
      publishDate: response.publishDate,
      tags: response.tags,
      imageMap,
      thumbnailUrls: response.thumbnailUrls,
      commentsData: response.commentsData
    });

    if (!markdownResponse?.success) {
      throw new Error('Failed to convert article to markdown');
    }

    // Create ZIP file
    const sanitizedTitle = sanitizeFilename(response.title);
    zip.file(`${sanitizedTitle}.md`, markdownResponse.markdown);

    await downloadZip(zip, `${sanitizedTitle}.zip`);

    chrome.runtime.sendMessage({ 
      action: 'exportSuccess', 
      message: getMessage('singleArticleExported')
    });
  } catch (error) {
    sendErrorMessage(getMessage('failedToExport') + (error instanceof Error ? error.message : String(error)));
  }
}

// Handle image download
async function handleImageDownload(): Promise<void> {
  try {
    const zip = new JSZip();
    const imageProcessor = new ImageProcessor(zip, currentExportDelay);
    
    exportState.type = 'images';
    
    await imageProcessor.downloadAllImages((current, total, pageInfo, currentItem) => {
      exportState.current = current;
      exportState.total = total;
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        type: 'images',
        current,
        total,
        pageInfo,
        currentItem
      });
    });
    
    await downloadZip(zip, 'lodestone_images.zip');

    exportState.isExporting = false;
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  } catch (error) {
    exportState.isExporting = false;
    sendErrorMessage(getMessage('failedToDownloadImages') + (error instanceof Error ? error.message : String(error)));
  }
}

// Handle cancel export
function handleCancelExport(): void {
  isCancelled = true;
  exportState.isExporting = false;
  exportState.showingProgress = false;
  exportState.showingConfirmation = false;
  exportState.current = 0;
  exportState.total = 0;
  
  // Clear stored entries data
  storedEntriesData = null;
  
  // Clean up global variables
  delete (globalThis as any).currentExportZip;
  delete (globalThis as any).currentImageMap;
  
  // Notify content script about cancellation
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'cancelExport'
      }).catch(() => {
        // Content script may not be available, ignore error
      });
    }
  });
  
  // Send cancel complete message to popup
  chrome.runtime.sendMessage({
    action: 'exportCancelled'
  }).catch(() => {
    // Popup may not be open, ignore error
  });
  
  // Close any open tabs that were created for scraping
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && tab.url.includes('/lodestone/character/') && 
          tab.url.includes('/blog/') && tab.active === false) {
        chrome.tabs.remove(tab.id!);
      }
    });
  });
}

// Fetch page in new tab
async function handleFetchPageInNewTab(url: string, delay: number, sendResponse: (response: any) => void): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delay));

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeAdditionalPage' });
    await chrome.tabs.remove(tab.id);

    sendResponse({ 
      success: response?.success || false, 
      entries: response?.data || [],
      message: response?.success ? undefined : 'Failed to scrape page'
    });
  } catch (error) {
    sendResponse({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
}

// Fetch article in new tab
async function handleFetchArticleInNewTab(url: string, delay: number, sendResponse: (response: any) => void): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    await new Promise(resolve => setTimeout(resolve, delay));

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSingleArticleData' });
    await chrome.tabs.remove(tab.id);

    sendResponse({ 
      success: response?.success || false, 
      article: response,
      message: response?.success ? undefined : 'Failed to get article data'
    });
  } catch (error) {
    sendResponse({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
}

// Handle confirm export all from content script
async function handleConfirmExportAllFromContent(): Promise<void> {
  if (!storedEntriesData) {
    sendErrorMessage(getMessage('exportDataNotFound'));
    return;
  }

  // Reset cancellation flag when starting export
  isCancelled = false;

  exportState = {
    isExporting: true,
    showingConfirmation: false,
    showingProgress: true,
    type: 'images', // 最初は画像エクスポート
    current: 0,
    total: 0
  };

  try {
    // 1. 最初に画像をダウンロード（自分のブログの場合のみ画像一覧から）
    const zip = new JSZip();
    const imageProcessor = new ImageProcessor(zip, storedEntriesData.exportDelay);
    let imageMap: ImageMap = {};
    
    if (storedEntriesData.isOwnBlog) {
      // 自分のブログ：画像一覧ページから全画像を収集してダウンロード
      imageMap = await collectAndDownloadAllImages(zip, storedEntriesData.exportDelay);
    }

    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }

    // 2. 記事を処理（記事内の追加画像も含む）
    exportState.type = 'articles';
    exportState.current = 0;
    exportState.total = storedEntriesData.entries.length;

    // Store ZIP and imageMap for later use
    (globalThis as any).currentExportZip = zip;
    (globalThis as any).currentImageMap = imageMap;

    // Request content script to process articles
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'processAllArticlesFromContent',
          entries: storedEntriesData!.entries,
          isOwnBlog: storedEntriesData!.isOwnBlog,
          exportDelay: storedEntriesData!.exportDelay,
          currentLanguage: storedEntriesData!.currentLanguage
        });
      }
    });

  } catch (error) {
    exportState.isExporting = false;
    sendErrorMessage(getMessage('failedToExport') + (error instanceof Error ? error.message : String(error)));
  }
}

// Create final ZIP file
async function handleCreateFinalZip(articles: any[], imageUrls: string[], isOwnBlog: boolean, currentLanguage: string): Promise<void> {
  try {
    // Use existing ZIP and imageMap from previous image download phase
    const zip = (globalThis as any).currentExportZip;
    let imageMap: ImageMap = (globalThis as any).currentImageMap || {};
    
    if (!zip) {
      throw new Error('ZIP file not found from image download phase');
    }

    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }

    // Download additional images from articles (not in image list)
    if (imageUrls.length > 0) {
      // 既存のZIPインスタンスを使用
      const imageProcessor = new ImageProcessor(zip, currentExportDelay);
      
      // Filter out images already downloaded
      const newImageUrls = imageUrls.filter(url => !imageMap[url]);
      
      if (newImageUrls.length > 0) {
        const additionalImageMap = await imageProcessor.downloadImages(newImageUrls, (current, total, pageInfo, currentItem) => {
          // これは記事内の追加画像なので、記事進捗に含める
          // 実際の進捗更新は別途行う
        }, () => isCancelled);
        
        // Merge image maps
        imageMap = { ...imageMap, ...additionalImageMap };
      }
    }

    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }

    // Convert articles to markdown and add to ZIP
    const articleListMarkdown: string[] = [];
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs[0]?.id) {
      throw new Error('No active tab found');
    }

    for (const article of articles) {
      if (isCancelled) {
        exportState.isExporting = false;
        return;
      }
      
      try {
        const markdownResponse = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'processImagesAndConvertToMarkdown',
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

        if (markdownResponse?.success) {
          const sanitizedTitle = sanitizeFilename(article.title);
          const filename = `${sanitizedTitle}.md`;
          
          zip.file(filename, markdownResponse.markdown);
          articleListMarkdown.push(`- [${article.title}](${filename})`);
        }
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

    exportState.isExporting = false;
    
    // Clean up global variables
    delete (globalThis as any).currentExportZip;
    delete (globalThis as any).currentImageMap;
    
    chrome.runtime.sendMessage({ action: 'exportComplete' });

  } catch (error) {
    exportState.isExporting = false;
    
    // Clean up global variables on error
    delete (globalThis as any).currentExportZip;
    delete (globalThis as any).currentImageMap;
    
    const lang = currentLanguage || 'ja';
    sendErrorMessage(backgroundMessages[lang].failedToExport + (error instanceof Error ? error.message : String(error)));
  }
}

// Helper function to download ZIP
async function downloadZip(zip: JSZip, filename: string): Promise<void> {
  const content = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const dataUrl = 'data:application/zip;base64,' + content;
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });
}

// Collect all image URLs from image list pages and download them
async function collectAndDownloadAllImages(zip: JSZip, exportDelay: number): Promise<ImageMap> {
  const allImageUrls = new Set<string>();
  let currentPage = 1;
  let totalPages = 1;
  
  // 画像収集の進捗を表示開始
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    type: 'images',
    current: 0,
    total: 1, // 最初は1ページと仮定
    pageInfo: { currentPage: 0, totalPages: 1 },
    currentItem: '画像一覧を収集中...'
  });
  
  // 各画像一覧ページから画像URLを収集
  while (currentPage <= totalPages) {
    if (isCancelled) {
      break;
    }
    
    const imageUrlListPage = `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${currentPage}`;
    
    try {
      const tab = await chrome.tabs.create({ url: imageUrlListPage, active: false });
      if (!tab.id) continue;
      
      await new Promise(resolve => setTimeout(resolve, exportDelay));
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'scrapeImageListPage' 
      });
      
      await chrome.tabs.remove(tab.id);
      
      if (response?.success) {
        response.imageUrls.forEach((url: string) => allImageUrls.add(url));
        
        if (currentPage === 1) {
          totalPages = response.totalPages || 1;
        }
        
        // 画像収集進捗を更新
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'images',
          current: allImageUrls.size,
          total: totalPages, // ページ数を分母に
          pageInfo: { currentPage, totalPages },
          currentItem: `ページ ${currentPage}/${totalPages}`
        });
      }
    } catch (error) {
      console.warn(`Failed to scrape image page ${currentPage}:`, error);
    }
    
    currentPage++;
  }
  
  if (isCancelled) {
    return {};
  }
  
  // 収集した画像をダウンロード
  const imageProcessor = new ImageProcessor(zip, exportDelay);
  return imageProcessor.downloadImages(Array.from(allImageUrls), (current, total, pageInfo, currentItem) => {
    exportState.current = current;
    exportState.total = total;
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'images',
      current,
      total,
      pageInfo,
      currentItem
    });
  }, () => isCancelled);
}

// Helper function to send error message
function sendErrorMessage(message: string): void {
  chrome.runtime.sendMessage({ 
    action: 'showError', 
    message 
  });
}