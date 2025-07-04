importScripts('lib/jszip.min.js');

// Function to generate a simple hash for unique filenames
function generateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

let currentExportDelay = 2000; // Default delay

let collectedArticles = [];
let expectedPages = 0;
let collectedPages = 0;
let articlesToExport = [];
let exportState = null;

async function collectAllBlogPages(firstPageData, totalPages) {
  
  // 収集状態をリセット
  collectedArticles = [...firstPageData];
  expectedPages = totalPages;
  collectedPages = 1; // 最初のページは既に収集済み

  if (totalPages === 1) {
    // 単一ページの場合はそのまま処理
    finalizeBlogCollection();
    return;
  }

  // 2ページ目以降を収集
  for (let page = 2; page <= totalPages; page++) {
    try {
      // 現在のタブのURLを取得してページネーションURLを構築
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const baseUrl = tabs[0].url.split('?')[0];
        const pageUrl = `${baseUrl}?page=${page}`;
        
        
        // 新しいタブでページを開く
        const tab = await chrome.tabs.create({ url: pageUrl, active: false });
        
        // ページの読み込み完了を待つ
        await new Promise(resolve => {
          const listener = (tabId, changeInfo, tab) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, currentExportDelay + 5000);
        });

        // ページから記事データを取得
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'scrapeAdditionalPage' });
        } catch (error) {
        }

        // タブを閉じる
        await chrome.tabs.remove(tab.id);
        
        // 次のページ処理前に遅延
        await new Promise(resolve => setTimeout(resolve, currentExportDelay));
      }
    } catch (error) {
    }
  }
}

function finalizeBlogCollection() {
  const articleUrls = collectedArticles.map(entry => entry.url);
  articlesToExport = articleUrls; // メモリに保存
  exportState = {
    isExporting: true,
    showingConfirmation: true,
    totalArticles: articleUrls.length
  };
  chrome.runtime.sendMessage({ action: 'showExportConfirmation', totalArticles: articleUrls.length });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExport') {
    currentExportDelay = request.exportDelay || 2000; // Update delay
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        
        // Check if the current URL matches the blog list page pattern (not individual article)
        const hasLodestone = currentUrl.includes('/lodestone/character/');
        const hasBlog = currentUrl.includes('/blog/');
        const hasEdit = currentUrl.includes('/edit');
        const isIndividualArticle = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/);
        const isBlogListPattern = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/);
        
        const isBlogListPage = hasLodestone && hasBlog && !hasEdit && !isIndividualArticle && isBlogListPattern;
        
        if (isBlogListPage) {
          try {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeLodestone' }, (response) => {
              if (chrome.runtime.lastError) {
                chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
              }
            });
          } catch (error) {
            chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
          }
        } else {
          chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
        }
      }
    });
  } else if (request.action === 'exportCurrentArticle') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        // Check if the current URL is a valid blog page (individual article or edit page)
        const isValidBlogPage = currentUrl.includes('/lodestone/character/') && 
                               currentUrl.includes('/blog/') && 
                               (currentUrl.includes('/edit') || 
                                currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/)); // Individual article pattern
        
        if (isValidBlogPage) {
          // 編集画面か個別記事画面かを判断
          if (currentUrl.includes('/edit')) {
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleContent' }, (response) => {
                if (chrome.runtime.lastError) {
                    chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                  return;
                }
                if (response && response.success) {
                  // 取得した記事内容をダウンロード
                  downloadMarkdown(response.content, 'article_edit.md');
                  exportState = null; // 状態をクリア
                  chrome.runtime.sendMessage({ action: 'exportSuccess', message: '記事をエクスポートしました！' });
                } else {
                  chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                }
              });
            } catch (error) {
                chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
            }
          } else {
            try {
              const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleDetails' });
              if (chrome.runtime.lastError) {
                chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                return;
              }
              if (response && response.success) {
                const { title, bodyHtml, likes, commentsCount, publishDate, tags, imageUrls, commentsData } = response;
                const imageMap = {};
                const zip = new JSZip();

                for (const imageUrl of imageUrls) {
                  if (imageUrl.includes('finalfantasyxiv.com')) {
                    try {
                      const imageResponse = await fetch(imageUrl);
                      const imageBlob = await imageResponse.blob();
                      const originalFilename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
                      const uniqueFilename = `${generateHash(imageUrl)}_${originalFilename}`;
                      const imagePath = `images/${uniqueFilename}`;
                      zip.file(imagePath, imageBlob);
                      imageMap[imageUrl] = imagePath;
                    } catch (error) {
                      }
                  }
                }

                const markdownResponse = await chrome.tabs.sendMessage(tabs[0].id, { action: 'processImagesAndConvertToMarkdown', title, htmlContent: bodyHtml, likes, commentsCount, publishDate, tags, imageMap, commentsData });
                if (markdownResponse && markdownResponse.success) {
                  const sanitizedTitle = title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();
                  zip.file(`${sanitizedTitle}.md`, markdownResponse.markdown);

                  zip.generateAsync({ type: 'blob' }).then(function(content) {
                    const url = URL.createObjectURL(content);
                    chrome.downloads.download({
                      url: url,
                      filename: `${sanitizedTitle}.zip`,
                      saveAs: true
                    });
                    exportState = null; // 状態をクリア
                    chrome.runtime.sendMessage({ action: 'exportSuccess', message: '記事をエクスポートしました！' });
                  });
                } else {
                }
              } else {
              }
            } catch (error) {
              chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
            }
          }
        } else {
          chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
        }
      } else {
        chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
      }
    });
  } else if (request.action === 'lodestoneData') {
    
    if (request.totalPages > 1) {
      // 複数ページがある場合、全ページから記事を収集
      collectAllBlogPages(request.data, request.totalPages);
    } else {
      // 単一ページの場合、そのまま処理
      const articleUrls = request.data.map(entry => entry.url);
      articlesToExport = articleUrls; // メモリに保存
      exportState = {
        isExporting: true,
        showingConfirmation: true,
        totalArticles: articleUrls.length
      };
      chrome.runtime.sendMessage({ action: 'showExportConfirmation', totalArticles: articleUrls.length });
    }
  } else if (request.action === 'additionalPageData') {
    collectedArticles = collectedArticles.concat(request.data);
    collectedPages++;
    
    // 全ページの収集が完了したかチェック
    if (collectedPages >= expectedPages) {
      finalizeBlogCollection();
    }
  } else if (request.action === 'confirmExport') {
    // User confirmed export, start the process
    currentExportDelay = request.exportDelay || 2000; // Update delay
    exportState = {
      isExporting: true,
      showingConfirmation: false,
      showingProgress: true
    };
    if (articlesToExport && articlesToExport.length > 0) {
      await exportAllArticles(articlesToExport);
      articlesToExport = []; // Clear stored URLs
    }
  } else if (request.action === 'getExportState') {
    sendResponse({ state: exportState });
    return true;
  }
});

function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

async function downloadAllImages(zip) {
  const allImageUrls = new Set();
  let currentPage = 1;
  let totalPages = 1;

  // First, get all image URLs from all image list pages
  while (currentPage <= totalPages) {
    const imageUrlListPage = `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${currentPage}`;
    const tab = await chrome.tabs.create({ url: imageUrlListPage, active: false });
    await new Promise(resolve => {
      const listener = (tabId, changeInfo, tab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Also add a timeout in case the page never fully loads
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, currentExportDelay + 5000); // currentExportDelay + a buffer
    });
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeImageListPage' });
      if (chrome.runtime.lastError) {
        console.error('Content scriptとの通信エラー:', chrome.runtime.lastError.message);
      } else if (response && response.success) {
        response.imageUrls.forEach(url => allImageUrls.add(url));
        totalPages = response.totalPages;
      } else {
        console.error(`画像一覧ページのスクレイピングに失敗しました: ${imageUrlListPage}`, response ? response.message : 'レスポンスがありません');
      }
    } catch (error) {
      console.error(`画像一覧ページのスクレイピングエラー: ${imageUrlListPage}`, error);
    }
    await chrome.tabs.remove(tab.id);
    currentPage++;
  }

  const imageMap = {}; // Map original URL to new local path
  let downloadedImageCount = 0;
  const totalImages = allImageUrls.size;

  for (const imageUrl of allImageUrls) {
    if (imageUrl.includes('finalfantasyxiv.com')) { // Only download Lodestone internal images
      try {
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();
        const originalFilename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        const uniqueFilename = `${generateHash(imageUrl)}_${originalFilename}`;
        const imagePath = `images/${uniqueFilename}`;
        zip.file(imagePath, imageBlob);
        imageMap[imageUrl] = imagePath;
        downloadedImageCount++;
        exportState = {
          isExporting: true,
          showingConfirmation: false,
          showingProgress: true,
          type: 'images',
          current: downloadedImageCount,
          total: totalImages
        };
        chrome.runtime.sendMessage({ action: 'updateProgress', type: 'images', current: downloadedImageCount, total: totalImages });
      } catch (error) {
        console.error(`画像のダウンロードに失敗しました: ${imageUrl}`, error);
      }
    } else {
      // For external images, just map them to their original URL
      imageMap[imageUrl] = imageUrl;
    }
  }
  return imageMap;
}

async function exportAllArticles(urls) {
  const zip = new JSZip();
  const imageMap = await downloadAllImages(zip); // Download all images first

  let processedArticleCount = 0;
  const totalArticles = urls.length;
  const articleListMarkdown = [];

  for (const url of urls) {
    try {
      const tab = await chrome.tabs.create({ url: url, active: false });
      // Wait for the tab to finish loading before sending message
      await new Promise(resolve => {
        const listener = (tabId, changeInfo, tab) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Also add a timeout in case the page never fully loads
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, currentExportDelay + 5000); // currentExportDelay + a buffer
      });

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleDetails' });
        if (chrome.runtime.lastError) {
          console.error('Content scriptとの通信エラー:', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          const { title, bodyHtml, likes, commentsCount, publishDate, tags, commentsData } = response;
          const markdownResponse = await chrome.tabs.sendMessage(tab.id, { action: 'processImagesAndConvertToMarkdown', title, htmlContent: bodyHtml, likes, commentsCount, publishDate, tags, imageMap, commentsData });
          if (markdownResponse && markdownResponse.success) {
            // Sanitize title for filename
            const sanitizedTitle = title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();
            const filename = `${sanitizedTitle}.md`;
            zip.file(filename, markdownResponse.markdown);
            articleListMarkdown.push(`- [${title}](${filename})`);
          } else {
            console.error('Markdown変換に失敗しました:', markdownResponse ? markdownResponse.message : 'レスポンスがありません');
          }
        } else { 
          console.error('記事詳細の取得に失敗しました:', response ? response.message : 'レスポンスがありません');
        }
      } catch (error) {
        console.error(`記事詳細取得エラー: ${url}`, error);
      }
      await chrome.tabs.remove(tab.id);
      processedArticleCount++;
      exportState = {
        isExporting: true,
        showingConfirmation: false,
        showingProgress: true,
        type: 'articles',
        current: processedArticleCount,
        total: totalArticles
      };
      chrome.runtime.sendMessage({ action: 'updateProgress', type: 'articles', current: processedArticleCount, total: totalArticles });
    } catch (error) {
      console.error(`記事 ${url} のエクスポート中にエラーが発生しました:`, error);
    }
  }

  // Add article list markdown to zip
  zip.file('記事一覧.md', articleListMarkdown.join('\n'));

  zip.generateAsync({ type: 'blob' }).then(function(content) {
    const url = URL.createObjectURL(content);
    chrome.downloads.download({
      url: url,
      filename: 'lodestone_articles.zip',
      saveAs: true
    });
    exportState = null; // 状態をクリア
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  });
}