import {
  BlogEntry,
  ExportState,
  SendResponse,
  FetchPageResponse,
  FetchArticleResponse,
  FetchImageListPageResponse,
  DownloadAllImagesResponse
} from '@/types';
import { CONFIG, URLS, calculateTimeout } from '@/utils/constants';
import { saveImage, getImage, getImageCount, clearAllImages, deleteDatabase, StoredImage } from '@/utils/indexedDB';
import { messages, SupportedLanguage, DEFAULT_LANGUAGE } from '@/locales/messages';
import { generateHash, sendErrorMessage, sleep, waitForTabLoad, extractFilenameFromUrl } from '@/utils/helpers';

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
let currentExportDelay: number = CONFIG.DEFAULT_EXPORT_DELAY;
let currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

// Stored entries data for content script approach
let storedEntriesData: {
  entries: BlogEntry[];
  isOwnBlog: boolean;
  exportDelay: number;
  currentLanguage: string;
} | null = null;

// Get message in current language
function getMessage(key: keyof typeof messages.ja): string {
  return messages[currentLanguage][key];
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
      console.log(`[PULL-RESPONSE-LOG] getDownloadedImage request for: ${extractFilenameFromUrl(imageUrl)}`);
      
      // Get from IndexedDB instead of globalThis
      getImage(imageUrl).then(imageData => {
        const response = { 
          success: !!imageData && imageData.success, 
          imageData: imageData || null
        };
        
        console.log(`[PULL-RESPONSE-LOG] Found image data:`, {
          found: !!imageData,
          hasBase64: !!imageData?.base64,
          base64Length: imageData?.base64?.length,
          filename: imageData?.filename,
          success: imageData?.success
        });
        
        sendResponse(response);
      }).catch(error => {
        console.error(`[PULL-RESPONSE-LOG] Error getting image from IndexedDB:`, error);
        sendResponse({ success: false, imageData: null });
      });
      
      return true; // Indicate async response
      
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
async function handleExportAllArticles(): Promise<void> {
  // 新しいエクスポート開始時に前回のデータをクリア
  storedEntriesData = null;
  
  // Delete entire database at the start of new export to ensure clean state
  try {
    await deleteDatabase();
    console.log('[Background] IndexedDB database deleted for clean start');
  } catch (error) {
    console.error('[Background] Failed to delete IndexedDB:', error);
    // Even if delete fails, clearAllImages as fallback
    try {
      await clearAllImages();
      console.log('[Background] Fallback: IndexedDB cleared for new export');
    } catch (clearError) {
      console.error('[Background] Failed to clear IndexedDB:', clearError);
    }
  }
  
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
async function handleCancelExport(): Promise<void> {
  isCancelled = true;
  exportState.isExporting = false;
  exportState.showingProgress = false;
  exportState.showingConfirmation = false;
  exportState.current = 0;
  exportState.total = 0;
  
  // Clear stored entries data
  storedEntriesData = null;
  
  // Delete database when export is cancelled
  try {
    await deleteDatabase();
    console.log('[Background] IndexedDB database deleted after cancel');
  } catch (error) {
    console.error('[Background] Failed to delete IndexedDB after cancel:', error);
  }
  
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
async function handleFetchPageInNewTab(url: string, delay: number, sendResponse: SendResponse<FetchPageResponse>): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    // Wait for tab to fully load (timeout based on user's export delay setting)
    await waitForTabLoad(tab.id, calculateTimeout(delay));

    // Additional delay for content script to initialize
    await sleep(delay);

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
async function handleFetchArticleInNewTab(url: string, delay: number, sendResponse: SendResponse<FetchArticleResponse>): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    // Wait for tab to fully load (timeout based on user's export delay setting)
    await waitForTabLoad(tab.id, calculateTimeout(delay));

    // Additional delay for content script to initialize
    await sleep(delay);

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
async function handleFetchImageListPage(url: string, delay: number, sendResponse: SendResponse<FetchImageListPageResponse>): Promise<void> {
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) {
      sendResponse({ success: false, message: 'Failed to create tab' });
      return;
    }

    // Wait for tab to fully load (timeout based on user's export delay setting)
    await waitForTabLoad(tab.id, calculateTimeout(delay));

    // Additional delay for content script to initialize
    await sleep(delay);

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
async function handleDownloadAllImages(imageUrls: string[], totalImages: number, sendResponse: SendResponse<DownloadAllImagesResponse>): Promise<void> {
  console.log('[DOWNLOAD-LOG] ========== START DOWNLOAD PHASE ==========');
  console.log('[DOWNLOAD-LOG] handleDownloadAllImages called with', imageUrls.length, 'images, totalImages:', totalImages);
  console.log('[DOWNLOAD-LOG] Sample URLs (first 5):', imageUrls.slice(0, 5));
  
  try {
    // Check existing images in IndexedDB
    const existingImageCount = await getImageCount();
    console.log(`[DOWNLOAD-LOG] Existing images in IndexedDB: ${existingImageCount}`);
    
    let downloadedCount = 0;
    let failedCount = 0;
    const failedUrls: string[] = [];
    const batchSize = 10; // Save to IndexedDB in batches for efficiency
    const imageBatch: StoredImage[] = [];

    // Update progress to show image downloading has started
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'images',
      current: 0,
      total: totalImages
    }).catch(() => {
      // Popup may not be open, ignore error
    });

    console.log('[DOWNLOAD-LOG] Starting download loop for', imageUrls.length, 'images');

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      
      if (isCancelled) {
        console.log('[DOWNLOAD-LOG] Download cancelled at image', downloadedCount, '/', imageUrls.length);
        break;
      }

      console.log(`[DOWNLOAD-LOG] Processing image ${i + 1}/${imageUrls.length}: ${extractFilenameFromUrl(imageUrl)}`);

      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log(`[DOWNLOAD-LOG] Image ${i + 1} blob size: ${blob.size} bytes, type: ${blob.type}`);
        
        // Convert to base64 instead of ArrayBuffer to avoid message passing issues
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        console.log(`[DOWNLOAD-LOG] Image ${i + 1} base64 length: ${base64.length} chars`);
        
        const originalFilename = extractFilenameFromUrl(imageUrl);
        const hash = generateHash(imageUrl);
        const uniqueFilename = `${hash}_${originalFilename}`;

        const imageData: StoredImage = {
          url: imageUrl,
          base64: base64,
          filename: uniqueFilename,
          success: true
        };

        // Add to batch
        imageBatch.push(imageData);
        
        // Save batch to IndexedDB when batch is full
        if (imageBatch.length >= batchSize) {
          await Promise.all(imageBatch.map(img => saveImage(img)));
          console.log(`[DOWNLOAD-LOG] Saved batch of ${imageBatch.length} images to IndexedDB`);
          imageBatch.length = 0; // Clear batch
        }

        downloadedCount++;
        
        if (downloadedCount % 10 === 0 || downloadedCount === totalImages) {
          const currentTotal = existingImageCount + downloadedCount;
          console.log(`[DOWNLOAD-LOG] Progress: Downloaded ${downloadedCount}/${totalImages} images (${Math.round(downloadedCount/totalImages*100)}%)`);
          console.log(`[DOWNLOAD-LOG] Total images in IndexedDB: ${currentTotal}`);
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
        failedCount++;
        failedUrls.push(imageUrl);
        console.error(`[DOWNLOAD-LOG] Failed to download image ${i + 1}: ${imageUrl}`, error);
        
        const failedImageData: StoredImage = {
          url: imageUrl,
          base64: '',
          filename: '',
          success: false
        };
        
        // Save failed image info to IndexedDB as well
        await saveImage(failedImageData);
      }
    }

    // Save remaining images in batch
    if (imageBatch.length > 0) {
      await Promise.all(imageBatch.map(img => saveImage(img)));
      console.log(`[DOWNLOAD-LOG] Saved final batch of ${imageBatch.length} images to IndexedDB`);
    }

    console.log('[DOWNLOAD-LOG] ========== DOWNLOAD PHASE COMPLETE ==========');
    console.log(`[DOWNLOAD-LOG] Total processed: ${imageUrls.length} images`);
    console.log(`[DOWNLOAD-LOG] Successfully downloaded: ${downloadedCount} images`);
    console.log(`[DOWNLOAD-LOG] Failed downloads: ${failedCount} images`);
    console.log(`[DOWNLOAD-LOG] Previously existing images: ${existingImageCount}`);
    const finalCount = await getImageCount();
    console.log(`[DOWNLOAD-LOG] Final total images in IndexedDB: ${finalCount}`);
    console.log(`[DOWNLOAD-LOG] Success rate: ${Math.round(downloadedCount/imageUrls.length*100)}%`);
    
    if (failedUrls.length > 0) {
      console.log('[DOWNLOAD-LOG] Failed URLs (first 10):', failedUrls.slice(0, 10));
    }
    
    // No longer storing in globalThis - all data is in IndexedDB
    console.log('[DOWNLOAD-LOG] ========== ALL IMAGES STORED IN INDEXEDDB ==========');
    console.log(`[DOWNLOAD-LOG] IndexedDB is now the single source of truth for all images`);
    
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