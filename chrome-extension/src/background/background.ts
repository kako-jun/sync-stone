import JSZip from 'jszip';
import { BlogEntry, ArticleDetails, ExportState, ImageMap } from '@/types';
import { CONFIG, URLS } from '@/utils/constants';
import { sanitizeFilename, waitForTabLoad } from '@/utils/helpers';
import { ImageProcessor } from '@/services/ImageProcessor';
// import { MarkdownConverter } from '@/services/MarkdownConverter';
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
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'exportSingleArticle') {
    handleSingleArticleExport();
    return true;
  }
  
  if (request.action === 'exportAllArticles') {
    // Check if we're already on the first page of blog list
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) return;
      
      const currentUrl = tab.url;
      const isBlogListFirstPage = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/) && 
                                  (!currentUrl.includes('page=') || currentUrl.includes('page=1'));
      
      if (isBlogListFirstPage) {
        // Already on first page, start export via content script
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'exportAllArticlesFromContent',
            exportDelay: currentExportDelay,
            isDeveloperMode,
            currentLanguage
          }).catch(error => {
            chrome.runtime.sendMessage({ 
              action: 'showError', 
              message: backgroundMessages[currentLanguage].contentScriptNotAvailable
            });
          });
        }
      } else {
        // Navigate to first page
        navigateToBlogListFirstPage();
      }
    });
    return true;
  }
  
  if (request.action === 'confirmExportAll') {
    // コンテンツスクリプトベースの処理の場合
    if (storedEntriesData) {
      handleConfirmExportAllFromContent();
    } else {
      // 従来の処理（フォールバック）
      handleAllArticlesExport();
    }
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
  
  if (request.action === 'fetchPageInNewTab') {
    handleFetchPageInNewTab(request.url, request.delay, sendResponse);
    return true;
  }
  
  if (request.action === 'fetchArticleInNewTab') {
    handleFetchArticleInNewTab(request.url, request.delay, sendResponse);
    return true;
  }
  
  if (request.action === 'setAllEntriesData') {
    // コンテンツスクリプトから記事データを受け取る
    handleSetAllEntriesData(request.entries, request.isOwnBlog, request.exportDelay, request.isDeveloperMode, request.currentLanguage);
    return true;
  }
  
  if (request.action === 'confirmExportAllFromContent') {
    handleConfirmExportAllFromContent();
    return true;
  }
  
  if (request.action === 'createFinalZip') {
    handleCreateFinalZip(request.articles, request.imageUrls, request.isOwnBlog, request.currentLanguage);
    return true;
  }
  
  return true;
});

async function handleSingleArticleExport(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.url || !tabs[0]?.id) return;

    // Get article data from content script
    let response;
    try {
      response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getSingleArticleData' });
    } catch (error) {
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

    // Download images - combine imageUrls and thumbnailUrls
    const allImageUrls = [...(article.imageUrls || []), ...(article.thumbnailUrls || [])];
    const imageMap = await imageProcessor.downloadImages(allImageUrls);

    // Convert to markdown using content script (like original JS version)
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const markdownResponse = await chrome.tabs.sendMessage(activeTabs[0].id!, {
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

    if (!markdownResponse?.success) {
      throw new Error('Failed to convert article to markdown');
    }

    const markdown = markdownResponse.markdown;

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
    
    // Get additional pages if needed (but respect developer mode)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const baseUrl = tabs[0]?.url;
    const shouldGetAdditionalPages = baseUrl && totalPages > 1 && !isCancelled && (!isDeveloperMode || entries.length < 5);
    if (shouldGetAdditionalPages) {
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

    // Limit article count for developer mode
    let processEntries = entries;
    if (isDeveloperMode && entries.length > 5) {
      processEntries = entries.slice(0, 5);
    }
    
    await processAllArticles(processEntries);
  } catch (error) {
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
  // const markdownConverter = new MarkdownConverter();
  
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
      // Convert to markdown using content script (like original JS version)
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      const markdownResponse = await chrome.tabs.sendMessage(tab[0].id!, {
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

      if (!markdownResponse?.success) {
        throw new Error('Failed to convert article to markdown');
      }

      const markdown = markdownResponse.markdown;
      const sanitizedTitle = sanitizeFilename(article.title);
      const filename = `${sanitizedTitle}.md`;
      
      zip.file(filename, markdown);
      articleListMarkdown.push(`- [${article.title}](${filename})`);
    } catch (error) {
      // Skip failed article
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
  
  // Limit article count display for developer mode
  let displayCount = data.length;
  if (isDeveloperMode && data.length > 5) {
    displayCount = 5;
  }
  
  // Show confirmation dialog
  chrome.runtime.sendMessage({
    action: 'showExportConfirmation',
    totalArticles: displayCount
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

// Global variables for content script approach
let storedEntriesData: any = null;

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

    if (response?.success) {
      sendResponse({ success: true, entries: response.data || [] });
    } else {
      sendResponse({ success: false, message: 'Failed to scrape page' });
    }
  } catch (error) {
    sendResponse({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
}

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

    if (response?.success) {
      sendResponse({ success: true, article: response });
    } else {
      sendResponse({ success: false, message: 'Failed to get article data' });
    }
  } catch (error) {
    sendResponse({ success: false, message: error instanceof Error ? error.message : String(error) });
  }
}

function handleSetAllEntriesData(entries: any[], isOwnBlog: boolean, exportDelay: number, isDeveloperMode: boolean, currentLanguage: string): void {
  storedEntriesData = {
    entries,
    isOwnBlog,
    exportDelay,
    isDeveloperMode,
    currentLanguage
  };
}

async function handleConfirmExportAllFromContent(): Promise<void> {
  if (!storedEntriesData) {
    chrome.runtime.sendMessage({
      action: 'showError',
      message: 'エクスポート用のデータが見つかりません'
    });
    return;
  }

  exportState = {
    isExporting: true,
    showingConfirmation: false,
    showingProgress: true,
    type: 'articles',
    current: 0,
    total: storedEntriesData.entries.length
  };

  // コンテンツスクリプトに記事処理を依頼
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'processAllArticlesFromContent',
        entries: storedEntriesData.entries,
        isOwnBlog: storedEntriesData.isOwnBlog,
        exportDelay: storedEntriesData.exportDelay,
        currentLanguage: storedEntriesData.currentLanguage
      });
    }
  });
}

async function handleCreateFinalZip(articles: any[], imageUrls: string[], isOwnBlog: boolean, currentLanguage: string): Promise<void> {
  try {
    const zip = new JSZip();
    const imageProcessor = new ImageProcessor(zip, currentExportDelay);

    // キャンセル処理のチェック
    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }

    // 画像をダウンロード（自分の記事の場合のみ進捗表示）
    let imageMap: ImageMap = {};
    if (imageUrls.length > 0) {
      // 自分の記事の場合のみ画像ダウンロード進捗を表示
      if (isOwnBlog) {
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'images',
          current: 0,
          total: imageUrls.length
        });
      }

      imageMap = await imageProcessor.downloadImages(imageUrls, (current, total, pageInfo, currentItem) => {
        // 自分の記事の場合のみ進捗を送信
        if (isOwnBlog) {
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            type: 'images',
            current,
            total,
            pageInfo,
            currentItem
          });
        }
      }, () => isCancelled);
    }

    // 画像ダウンロード後のキャンセルチェック
    if (isCancelled) {
      exportState.isExporting = false;
      return;
    }

    // 記事リスト用
    const articleListMarkdown: string[] = [];

    // 各記事をMarkdownに変換してZIPに追加
    for (const article of articles) {
      // 各記事処理前にキャンセルチェック
      if (isCancelled) {
        exportState.isExporting = false;
        return;
      }
      try {
        // コンテンツスクリプトでMarkdown変換
        const tab = await chrome.tabs.query({ active: true, currentWindow: true });
        const markdownResponse = await chrome.tabs.sendMessage(tab[0].id!, {
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

    // 記事一覧を追加
    const articleListContent = `# Articles Index\n\n${articleListMarkdown.join('\n')}`;
    zip.file('index.md', articleListContent);

    // ZIPファイルを生成・ダウンロード
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

  } catch (error) {
    exportState.isExporting = false;
    chrome.runtime.sendMessage({
      action: 'showError',
      message: backgroundMessages[currentLanguage].failedToExport + (error instanceof Error ? error.message : String(error))
    });
  }
}