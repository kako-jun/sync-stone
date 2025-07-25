importScripts('lib/jszip.min.js');

// 実験用：収集ページ数制限（本来は全ページ）
const EXPERIMENTAL_MAX_PAGES = 2;

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
let backgroundTabId = null; // バックグラウンドタブのIDを記録

async function collectAllBlogPages(firstPageData, totalPages) {
  
  // 収集状態をリセット
  collectedArticles = [...firstPageData];
  const maxPages = Math.min(totalPages, EXPERIMENTAL_MAX_PAGES);
  expectedPages = maxPages;
  collectedPages = 1; // 最初のページは既に収集済み

  // 初期進捗を送信（実験用制限）
  exportState = {
    isExporting: true,
    showingConfirmation: false,
    showingProgress: true,
    type: 'collecting',
    current: 1,
    total: maxPages
  };
  chrome.runtime.sendMessage({ action: 'updateProgress', type: 'collecting', current: 1, total: maxPages, articles: firstPageData.length });

  if (totalPages === 1) {
    // 単一ページの場合はそのまま処理
    finalizeBlogCollection();
    return;
  }

  // 2ページ目以降を収集（実験用制限）
  for (let page = 2; page <= maxPages; page++) {
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
          // 真のタイムアウト（異常時のみ）
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 10000);
        });

        // ページから記事データを取得
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'scrapeAdditionalPage' });
          // メッセージ送信後、少し待ってcontent scriptの処理完了を確保
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('scrapeAdditionalPage error:', error);
        }

        // タブを閉じる
        await chrome.tabs.remove(tab.id);
        
        // 進捗を更新
        exportState = {
          isExporting: true,
          showingConfirmation: false,
          showingProgress: true,
          type: 'collecting',
          current: page,
          total: maxPages
        };
        chrome.runtime.sendMessage({ action: 'updateProgress', type: 'collecting', current: page, total: maxPages, articles: collectedArticles.length });
        
        // ページ収集は読み込み次第すぐに次へ（待機時間なし）
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
  
  // バックグラウンドタブは残す（ユーザーが手動で確認可能）
  console.log('Finalized blog collection, background tab remains open for inspection');
  backgroundTabId = null; // IDはクリアするが、タブは残す
  
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
          // 目次ページの場合は必ず1ページ目から開始
          const baseUrl = currentUrl.split('?')[0]; // クエリパラメータを除去
          const firstPageUrl = baseUrl; // 1ページ目のURL
          
          if (currentUrl !== firstPageUrl) {
            // 現在2ページ目以降にいる場合は1ページ目に移動
            chrome.tabs.update(tabs[0].id, { url: firstPageUrl }, () => {
              // ページ移動後にスクレイピング開始
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeLodestone' }, (response) => {
                  if (chrome.runtime.lastError) {
                    chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
                  }
                });
              }, 1000); // ページ読み込み待機
            });
          } else {
            // 既に1ページ目にいる場合は通常通りスクレイピング
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeLodestone' }, (response) => {
                if (chrome.runtime.lastError) {
                  chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
                }
              });
            } catch (error) {
              chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
            }
          }
        } else if (hasLodestone && hasBlog) {
          // 個別記事ページの場合は目次ページを開くだけ
          const characterMatch = currentUrl.match(/\/lodestone\/character\/(\d+)\//);
          if (characterMatch) {
            const characterId = characterMatch[1];
            const blogListUrl = `https://jp.finalfantasyxiv.com/lodestone/character/${characterId}/blog/`;
            
            // 新しいタブで目次ページを開く
            chrome.tabs.create({ url: blogListUrl, active: true });
          } else {
            chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
          }
        } else {
          chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnBlogListPageError') });
        }
      }
    });
  } else if (request.action === 'exportCurrentArticle') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        // Check if the current URL is a valid blog page (individual article or edit page)
        const isValidBlogPage = currentUrl.includes('/lodestone/character/') && 
                               currentUrl.includes('/blog/') && 
                               (currentUrl.includes('/edit') || 
                                currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/)); // Individual article pattern
        
        if (isValidBlogPage) {
          console.log('Valid blog page detected:', currentUrl);
          // 編集画面か個別記事画面かを判断
          if (currentUrl.includes('/edit')) {
            console.log('Edit page detected, using getArticleContent');
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleContent' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending message to content script:', chrome.runtime.lastError);
                  chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                  return;
                }
                if (response && response.success) {
                  // 取得した記事内容をダウンロード
                  downloadMarkdown(response.content, 'article_edit.md');
                  exportState = null; // 状態をクリア
                  chrome.runtime.sendMessage({ action: 'exportSuccess', message: 'Article exported successfully!' });
                } else {
                  console.error('Failed to get article content:', response);
                  chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                }
              });
            } catch (error) {
              console.error('Exception in getArticleContent:', error);
              chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
            }
          } else {
            console.log('Individual article page detected, using getArticleDetails');
            try {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleDetails' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending message to content script:', chrome.runtime.lastError);
                  chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                  return;
                }
              if (response && response.success) {
                console.log('Successfully got article details:', response);
                const { title, bodyHtml, likes, commentsCount, publishDate, tags, imageUrls, commentsData } = response;
                const imageMap = {};
                const zip = new JSZip();

                // 画像ダウンロードを順次処理
                async function downloadImages() {
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
                        console.error('Error downloading image:', imageUrl, error);
                      }
                    }
                  }
                }
                
                downloadImages().then(() => {
                  chrome.tabs.sendMessage(tabs[0].id, { action: 'processImagesAndConvertToMarkdown', title, htmlContent: bodyHtml, likes, commentsCount, publishDate, tags, imageMap, commentsData }, (markdownResponse) => {
                  if (markdownResponse && markdownResponse.success) {
                    console.log('Successfully converted to markdown');
                    const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 50);
                  zip.file(`${sanitizedTitle}.md`, markdownResponse.markdown, { 
                    binary: false,
                    compression: "DEFLATE"
                  });

                  zip.generateAsync({ 
                    type: 'base64',
                    compression: "DEFLATE",
                    compressionOptions: {
                      level: 6
                    }
                  }).then(function(content) {
                    const dataUrl = 'data:application/zip;base64,' + content;
                    chrome.downloads.download({
                      url: dataUrl,
                      filename: `${sanitizedTitle}.zip`,
                      saveAs: false
                    }, (downloadId) => {
                      if (chrome.runtime.lastError) {
                        console.error('Download failed:', chrome.runtime.lastError);
                        chrome.runtime.sendMessage({ action: 'showError', message: `Download failed: ${chrome.runtime.lastError.message}` });
                      } else {
                        console.log('Download started with ID:', downloadId);
                        chrome.runtime.sendMessage({ action: 'exportSuccess', message: `Article "${title}" download started! File: ${sanitizedTitle}.zip` });
                      }
                    });
                    exportState = null; // 状態をクリア
                  }).catch(error => {
                    console.error('ZIP generation failed:', error);
                    chrome.runtime.sendMessage({ action: 'showError', message: `ZIP creation failed: ${error.message}` });
                  });
                    } else {
                      console.error('Failed to convert to markdown:', markdownResponse);
                      chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
                    }
                  });
                });
              } else {
                console.error('Failed to get article details:', response);
                chrome.runtime.sendMessage({ action: 'showError', message: chrome.i18n.getMessage('notOnIndividualArticlePageError') });
              }
              });
            } catch (error) {
              console.error('Exception in getArticleDetails:', error);
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
      
      // バックグラウンドタブは残す（ユーザーが手動で確認可能）
      console.log('Single page case, background tab remains open for inspection');
      backgroundTabId = null; // IDはクリアするが、タブは残す
      
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
      exportAllArticles(articlesToExport).then(() => {
        articlesToExport = []; // Clear stored URLs
      });
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
            const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 50);
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

  zip.generateAsync({ type: 'base64' }).then(function(content) {
    const dataUrl = 'data:application/zip;base64,' + content;
    chrome.downloads.download({
      url: dataUrl,
      filename: 'lodestone_articles.zip',
      saveAs: false
    });
    exportState = null; // 状態をクリア
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  });
}