import { BlogEntry, ExportState } from '@/types';
import { CONFIG, URLS } from '@/utils/constants';

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
let currentLanguage = 'ja';

// Stored entries data for content script approach
let storedEntriesData: {
  entries: BlogEntry[];
  isOwnBlog: boolean;
  exportDelay: number;
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
      currentLanguage = request.language || 'ja';
      sendResponse({ success: true });
      break;
      
      
    case 'exportAllArticles':
      handleExportAllArticles();
      break;
      
    case 'confirmExportAll':
      if (storedEntriesData) {
        handleConfirmExportAllFromContent();
      }
      break;
      
      
    case 'cancelExport':
      handleCancelExport();
      sendResponse({ success: true });
      break;
      
      
    case 'fetchPageInNewTab':
      handleFetchPageInNewTab(request.url, request.delay, sendResponse);
      return true; // 非同期処理のため
      
    case 'fetchArticleInNewTab':
      handleFetchArticleInNewTab(request.url, request.delay, sendResponse);
      return true; // 非同期処理のため
      
    case 'fetchImageListPage':
      handleFetchImageListPage(request.url, request.delay, sendResponse);
      return true; // 非同期処理のため
      
    case 'downloadAllImages':
      handleDownloadAllImages(request.imageUrls, request.totalImages, sendResponse);
      return true; // 非同期処理のため
      
    case 'getDownloadedImage':
      const imageUrl = request.imageUrl;
      const allImages = (globalThis as any).downloadedImages || [];
      const imageData = allImages.find((img: any) => img.url === imageUrl);
      sendResponse({ 
        success: !!imageData, 
        imageData: imageData || null
      });
      break;
      
    case 'setAllEntriesData':
      console.log('[Background] setAllEntriesData received with:', {
        entriesCount: request.entries?.length,
        isOwnBlog: request.isOwnBlog,
        exportDelay: request.exportDelay,
        currentLanguage: request.currentLanguage
      });
      storedEntriesData = {
        entries: request.entries,
        isOwnBlog: request.isOwnBlog,
        exportDelay: request.exportDelay,
        currentLanguage: request.currentLanguage
      };
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
  // 新しいエクスポート開始時に前回のデータをクリア
  storedEntriesData = null;
  
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
        currentLanguage
      }).catch(() => {
        sendErrorMessage(getMessage('contentScriptNotAvailable'));
      });
    } else {
      navigateToBlogListFirstPage();
    }
  });
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

    // Wait for tab to fully load
    await new Promise<void>((resolve) => {
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Additional delay for content script to initialize
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

    // Wait for tab to fully load
    await new Promise<void>((resolve) => {
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Additional delay for content script to initialize
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

// Fetch image list page in new tab
async function handleFetchImageListPage(url: string, delay: number, sendResponse: (response: any) => void): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    // Wait for tab to fully load
    await new Promise<void>((resolve) => {
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Additional delay for content script to initialize
    await new Promise(resolve => setTimeout(resolve, delay));

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeImageListPage' });
    await chrome.tabs.remove(tab.id);

    sendResponse({ 
      success: response?.success || false, 
      imageUrls: response?.imageUrls || [],
      totalPages: response?.totalPages || 1,
      message: response?.success ? undefined : 'Failed to scrape image list page'
    });
  } catch (error) {
    sendResponse({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
}

// Handle downloading all images from background script (optimized for message passing)
async function handleDownloadAllImages(imageUrls: string[], totalImages: number, sendResponse: (response: any) => void): Promise<void> {
  console.log('[Background] handleDownloadAllImages called with', imageUrls.length, 'images, totalImages:', totalImages);
  try {
    const downloadedImages: any[] = [];
    let downloadedCount = 0;

    // Update progress to show image downloading has started
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'images',
      current: 0,
      total: totalImages
    }).catch(() => {
      // Popup may not be open, ignore error
    });


    for (const imageUrl of imageUrls) {
      if (isCancelled) {
        console.log('[Background] Download cancelled at image', downloadedCount);
        break;
      }

      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        // Convert to base64 instead of ArrayBuffer to avoid message passing issues
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        const originalFilename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        const hash = generateHash(imageUrl);
        const uniqueFilename = `${hash}_${originalFilename}`;

        downloadedImages.push({
          url: imageUrl,
          base64: base64,
          filename: uniqueFilename,
          success: true
        });

        downloadedCount++;
        
        if (downloadedCount % 50 === 0 || downloadedCount === totalImages) {
          console.log('[Background] Downloaded', downloadedCount, '/', totalImages, 'images');
        }
        
        // Update progress
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'images',
          current: downloadedCount,
          total: totalImages
        }).catch(() => {
          // Popup may not be open, ignore error
        });

      } catch (error) {
        console.error(`Failed to download image: ${imageUrl}`, error);
        downloadedImages.push({
          url: imageUrl,
          base64: null,
          filename: null,
          success: false
        });
      }
    }

    console.log('[Background] All downloads completed. Total:', downloadedCount, '/', totalImages);
    
    // Store images globally for retrieval
    (globalThis as any).downloadedImages = downloadedImages;
    
    // Send completion signal without images array (pull-based approach)
    const responseData = {
      success: true,
      totalDownloaded: downloadedCount,
      message: 'Download completed, images stored globally'
    };
    console.log('[Background] About to send response:', responseData);
    try {
      sendResponse(responseData);
      console.log('[Background] Response sent successfully');
    } catch (error) {
      console.error('[Background] Failed to send response:', error);
    }

  } catch (error) {
    const errorResponse = {
      success: false,
      message: `Failed to download images: ${error instanceof Error ? error.message : String(error)}`,
      images: []
    };
    console.log('[Background] About to send error response:', errorResponse);
    try {
      sendResponse(errorResponse);
      console.log('[Background] Error response sent successfully');
    } catch (sendError) {
      console.error('[Background] Failed to send error response:', sendError);
    }
  }
}

// Helper function to generate hash (same as content script)
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// Handle confirm export all from content script
async function handleConfirmExportAllFromContent(): Promise<void> {
  console.log('[Background] handleConfirmExportAllFromContent called');
  if (!storedEntriesData) {
    console.log('[Background] storedEntriesData is null!');
    sendErrorMessage(getMessage('exportDataNotFound'));
    return;
  }
  console.log('[Background] storedEntriesData.isOwnBlog:', storedEntriesData.isOwnBlog);

  // Reset cancellation flag when starting export
  isCancelled = false;

  exportState = {
    isExporting: true,
    showingConfirmation: false,
    showingProgress: true,
    type: 'articles',
    current: 0,
    total: storedEntriesData.entries.length
  };

  try {
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



// Helper function to send error message
function sendErrorMessage(message: string): void {
  chrome.runtime.sendMessage({ 
    action: 'showError', 
    message 
  });
}