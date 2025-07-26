import JSZip from 'jszip';
import { BlogEntry, ArticleDetails, ExportState, ImageMap } from '@/types';
import { CONFIG, URLS } from '@/utils/constants';
import { sanitizeFilename, waitForTabLoad } from '@/utils/helpers';
import { ImageProcessor } from '@/services/ImageProcessor';
import { MarkdownConverter } from '@/services/MarkdownConverter';
import { LodestoneAPI } from '@/services/LodestoneAPI';

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
let isOwnBlog = true;
let currentLanguage = 'ja'; // Default language

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
    blogListMoved: 'ブログ一覧ページに移動しました。全記事エクスポートボタンをもう一度押してください。'
  },
  en: {
    contentScriptNotAvailable: 'Please reload the page and try again.',
    couldNotRetrieveData: 'Could not retrieve article data from page.',
    notOnBlogListPageError: 'Not on blog list page.',
    singleArticleExported: 'Single article exported successfully!',
    exportComplete: 'Export complete!',
    failedToExport: 'Failed to export: ',
    failedToDownloadImages: 'Failed to download images: ',
    blogListMoved: 'Moved to blog list page. Please press the export all articles button again.'
  }
};

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
    chrome.runtime.sendMessage({ 
      action: 'showError', 
      message: backgroundMessages[currentLanguage].notOnBlogListPageError 
    });
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
      
      // Create tab and inject notification
      chrome.tabs.create({ url: blogListUrl, active: true }, (newTab) => {
        // Wait for page to load then show notification
        setTimeout(() => {
          if (newTab.id) {
            chrome.tabs.sendMessage(newTab.id, {
              action: 'showExportNotification',
              message: backgroundMessages[currentLanguage].blogListMoved
            });
          }
        }, currentExportDelay);
      });
    } else {
      chrome.runtime.sendMessage({ 
        action: 'showError', 
        message: backgroundMessages[currentLanguage].notOnBlogListPageError 
      });
    }
  });
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getExportState') {
    sendResponse(exportState);
    return true;
  }
  
  if (request.action === 'setExportDelay') {
    currentExportDelay = Math.max(request.delay || CONFIG.DEFAULT_EXPORT_DELAY, CONFIG.MIN_EXPORT_DELAY);
    isDeveloperMode = request.developerMode || false;
    currentLanguage = request.language || 'ja'; // Update language setting
    console.log(`開発者モード: ${isDeveloperMode ? '有効' : '無効'}, 遅延: ${currentExportDelay}ms, 言語: ${currentLanguage}`);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'exportSingleArticle') {
    handleSingleArticleExport();
    return true;
  }
  
  if (request.action === 'exportAllArticles') {
    console.log('exportAllArticles action received');
    // Check if we're already on the first page of blog list
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) return;
      
      console.log('Current URL:', tab.url);
      const currentUrl = tab.url;
      const isBlogListFirstPage = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/) && 
                                  (!currentUrl.includes('page=') || currentUrl.includes('page=1'));
      
      console.log('Is blog list first page:', isBlogListFirstPage);
      
      if (isBlogListFirstPage) {
        // Already on first page, start export directly
        if (tab.id) {
          console.log('Sending scrapeLodestone message to tab:', tab.id);
          chrome.tabs.sendMessage(tab.id, { action: 'scrapeLodestone' }).catch(error => {
            console.error('Failed to send message to content script:', error);
            chrome.runtime.sendMessage({ 
              action: 'showError', 
              message: backgroundMessages[currentLanguage].contentScriptNotAvailable
            });
          });
        }
      } else {
        // Navigate to first page
        console.log('Navigating to first page');
        navigateToBlogListFirstPage();
      }
    });
    return true;
  }
  
  if (request.action === 'confirmExportAll') {
    handleAllArticlesExport();
    return true;
  }
  
  if (request.action === 'downloadImages') {
    handleImageDownload();
    return true;
  }
  
  if (request.action === 'lodestoneData') {
    isOwnBlog = request.isOwnBlog !== undefined ? request.isOwnBlog : true;
    handleLodestoneData(request.data, request.totalPages);
    return true;
  }
  
  if (request.action === 'additionalPageData') {
    handleAdditionalPageData(request.data);
    return true;
  }
  
  if (request.action === 'cancelExport') {
    handleCancelExport();
    return true;
  }
  
  return true;
});

async function handleSingleArticleExport(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.url || !tabs[0]?.id) return;

    console.log('Attempting single article export on URL:', tabs[0].url);

    // Get article data from content script
    let response;
    try {
      response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSingleArticleData' });
      console.log('Content script response:', response);
    } catch (error) {
      console.error('Failed to communicate with content script:', error);
      throw new Error(backgroundMessages[currentLanguage].contentScriptNotAvailable);
    }
    
    if (!response?.success) {
      throw new Error(backgroundMessages[currentLanguage].couldNotRetrieveData);
    }
    
    // Convert response to ArticleDetails format
    const article: ArticleDetails = {
      title: response.title,
      bodyHtml: response.bodyHtml,
      likes: response.likes,
      commentsCount: response.commentsCount,
      publishDate: response.publishDate,
      tags: response.tags,
      imageUrls: response.imageUrls,
      thumbnailUrls: response.thumbnailUrls,
      commentsData: response.commentsData
    };
    
    const zip = new JSZip();
    const imageProcessor = new ImageProcessor(zip, currentExportDelay);
    const markdownConverter = new MarkdownConverter();

    // Download images
    const imageMap = await imageProcessor.downloadImages(article.imageUrls);

    // Convert to markdown
    const markdown = markdownConverter.convertArticleToMarkdown(article, imageMap);

    // Create ZIP file
    const sanitizedTitle = sanitizeFilename(article.title);
    zip.file(`${sanitizedTitle}.md`, markdown, {
      binary: false,
      compression: 'DEFLATE'
    });

    const content = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const dataUrl = 'data:application/zip;base64,' + content;
    await chrome.downloads.download({
      url: dataUrl,
      filename: `${sanitizedTitle}.zip`,
      saveAs: false
    });

    chrome.runtime.sendMessage({ 
      action: 'exportSuccess', 
      message: backgroundMessages[currentLanguage].singleArticleExported
    });
  } catch (error) {
    console.error('Error in single article export:', error);
    chrome.runtime.sendMessage({ 
      action: 'showError', 
      message: backgroundMessages[currentLanguage].failedToExport + (error instanceof Error ? error.message : String(error))
    });
  }
}

async function handleAllArticlesExport(): Promise<void> {
  exportState = {
    isExporting: true,
    showingConfirmation: false,
    showingProgress: true,
    type: 'articles',
    current: 0,
    total: 0
  };
  
  isCancelled = false;

  try {
    const lodestoneAPI = new LodestoneAPI(currentExportDelay);
    const { entries, totalPages } = await lodestoneAPI.scrapeBlogEntries();
    
    // Get additional pages if needed
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const baseUrl = tabs[0]?.url;
    if (baseUrl && totalPages > 1 && !isCancelled) {
      const additionalEntries = await lodestoneAPI.scrapeAdditionalPages(baseUrl, totalPages, (current, total, pageInfo, currentItem) => {
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'pages',
          current,
          total,
          pageInfo,
          currentItem
        });
      }, () => isCancelled);
      entries.push(...additionalEntries);
    }

    // 開発者モードで記事数を制限
    let processEntries = entries;
    if (isDeveloperMode && entries.length > 5) {
      console.log(`開発者モード: ${entries.length}件中5件のみ処理します`);
      processEntries = entries.slice(0, 5);
    }
    
    await processAllArticles(processEntries);
  } catch (error) {
    console.error('Error in all articles export:', error);
    exportState.isExporting = false;
    chrome.runtime.sendMessage({ 
      action: 'showError', 
      message: backgroundMessages[currentLanguage].failedToExport + (error instanceof Error ? error.message : String(error)) 
    });
  }
}

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
    
    const content = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const dataUrl = 'data:application/zip;base64,' + content;
    await chrome.downloads.download({
      url: dataUrl,
      filename: 'lodestone_images.zip',
      saveAs: false
    });

    exportState.isExporting = false;
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  } catch (error) {
    console.error('Error downloading images:', error);
    exportState.isExporting = false;
    chrome.runtime.sendMessage({ 
      action: 'showError', 
      message: backgroundMessages[currentLanguage].failedToDownloadImages + (error instanceof Error ? error.message : String(error)) 
    });
  }
}

async function processAllArticles(blogEntries: BlogEntry[]): Promise<void> {
  const zip = new JSZip();
  const lodestoneAPI = new LodestoneAPI(currentExportDelay);
  const imageProcessor = new ImageProcessor(zip, currentExportDelay);
  const markdownConverter = new MarkdownConverter();
  
  exportState.total = blogEntries.length;
  
  // Download all images first - but only for own blog
  let imageMap: ImageMap = {};
  if (isOwnBlog) {
    imageMap = await imageProcessor.downloadAllImages((current, total, pageInfo, currentItem) => {
      if (isCancelled) {
        return false; // Signal to stop processing
      }
      
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        type: 'images',
        current,
        total,
        pageInfo,
        currentItem
      });
    }, () => isCancelled);
  } else {
    console.log('他人のブログのため、画像一覧のダウンロードをスキップします');
  }
  
  // Check for cancellation after image download
  if (isCancelled) {
    exportState.isExporting = false;
    return;
  }
  
  // Check for cancellation before processing articles
  if (isCancelled) {
    exportState.isExporting = false;
    return;
  }
  
  // Process articles
  const articleListMarkdown: string[] = [];
  const urls = blogEntries.map(entry => entry.url);
  
  const articles = await lodestoneAPI.processArticlesBatch(urls, (current, total, pageInfo, currentItem) => {
    if (isCancelled) {
      return false; // Signal to stop processing
    }
    
    exportState.current = current;
    exportState.total = total;
    exportState.type = 'articles';
    
    chrome.runtime.sendMessage({
      action: 'updateProgress',
      type: 'articles',
      current,
      total,
      pageInfo,
      currentItem
    });
  }, () => isCancelled, isOwnBlog);
  
  // Check for cancellation before final processing
  if (isCancelled) {
    exportState.isExporting = false;
    return;
  }
  
  // For other's blog, download images from articles after processing them
  if (!isOwnBlog && articles.length > 0) {
    console.log('他人のブログ: 記事内画像をダウンロードします');
    
    const articlesWithImages = articles.map(article => ({
      title: article.title,
      imageUrls: article.imageUrls
    }));
    
    const articleImageMap = await imageProcessor.downloadImagesFromArticles(
      articlesWithImages,
      (current, total, pageInfo, currentItem) => {
        if (isCancelled) {
          return false;
        }
        
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'images',
          current,
          total,
          pageInfo,
          currentItem
        });
      },
      () => isCancelled
    );
    
    // Merge article images into main image map
    Object.assign(imageMap, articleImageMap);
  }
  
  // Convert articles to markdown and add to ZIP
  for (const article of articles) {
    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }
    
    try {
      const markdown = markdownConverter.convertArticleToMarkdown(article, imageMap);
      const sanitizedTitle = sanitizeFilename(article.title);
      const filename = `${sanitizedTitle}.md`;
      
      zip.file(filename, markdown);
      articleListMarkdown.push(`- [${article.title}](${filename})`);
    } catch (error) {
      console.error(`Error processing article: ${article.title}`, error);
    }
  }

  // Final cancellation check before generating ZIP
  if (isCancelled) {
    exportState.isExporting = false;
    return;
  }
  
  // Generate article list
  const articleListContent = `# Articles Index\n\n${articleListMarkdown.join('\n')}`;
  zip.file('index.md', articleListContent);

  // Download final ZIP
  const content = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const dataUrl = 'data:application/zip;base64,' + content;
  const filename = isOwnBlog ? 'lodestone_blog_export.zip' : 'lodestone_others_blog_export.zip';
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });

  exportState.isExporting = false;
  chrome.runtime.sendMessage({ action: 'exportComplete' });
}

async function handleLodestoneData(data: BlogEntry[], totalPages: number): Promise<void> {
  console.log('handleLodestoneData called with', data.length, 'articles');
  
  // Show confirmation dialog
  chrome.runtime.sendMessage({
    action: 'showExportConfirmation',
    totalArticles: data.length
  });
  
  // Set export state for confirmation
  exportState = {
    isExporting: false,
    showingConfirmation: true,
    showingProgress: false,
    type: 'articles',
    current: 0,
    total: data.length
  };
}

function handleCancelExport(): void {
  isCancelled = true;
  exportState.isExporting = false;
  exportState.showingProgress = false;
  
  // Close any open tabs that were created for scraping
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && tab.url.includes('/lodestone/character/') && tab.url.includes('/blog/')) {
        // Only close tabs that were likely created by our extension
        if (tab.active === false) {
          chrome.tabs.remove(tab.id!);
        }
      }
    });
  });
}

async function handleAdditionalPageData(data: BlogEntry[]): Promise<void> {
  // This is now handled directly in handleAllArticlesExport
}