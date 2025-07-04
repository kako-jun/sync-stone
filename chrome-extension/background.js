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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExport') {
    console.log('エクスポート開始リクエストを受信しました。');
    currentExportDelay = request.exportDelay || 2000; // Update delay
    // This action will now trigger the full export process including image download
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // First, scrape all article URLs
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeLodestone' });
      }
    });
  } else if (request.action === 'exportCurrentArticle') {
    console.log('現在の記事のエクスポートリクエストを受信しました。');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].url.includes('/lodestone/character/') && tabs[0].url.includes('/blog/')) {
        // 編集画面か個別記事画面かを判断
        if (tabs[0].url.includes('/edit')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleContent' }, (response) => {
            if (response && response.success) {
              console.log('取得した記事内容 (編集画面):', response.content);
              // 取得した記事内容をダウンロード
              downloadMarkdown(response.content, 'article_edit.md');
            } else {
              console.error('記事内容の取得に失敗しました:', response.message);
            }
          });
        } else {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleDetails' });
          if (response && response.success) {
            console.log('取得した記事詳細 (個別記事画面):', response);
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
                  console.error(`画像のダウンロードに失敗しました: ${imageUrl}`, error);
                }
              } else {
                // For external images, just map them to their original URL
                imageMap[imageUrl] = imageUrl;
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
              });
            } else {
              console.error('Markdown変換に失敗しました:', markdownResponse.message);
            }
          } else {
            console.error('記事詳細の取得に失敗しました:', response.message);
          }
        }
      } else {
        console.warn('現在のタブはロドストの日記ページではありません。');
      }
    });
  } else if (request.action === 'lodestoneData') {
    console.log('lodestoneDataを受信しました:', request.data);
    const articleUrls = request.data.map(entry => entry.url);
    // Send message to popup to confirm export and show progress
    chrome.runtime.sendMessage({ action: 'showExportConfirmation', totalArticles: articleUrls.length });
    // Store articleUrls temporarily
    chrome.storage.local.set({ 'articlesToExport': articleUrls });
  } else if (request.action === 'confirmExport') {
    // User confirmed export, start the process
    currentExportDelay = request.exportDelay || 2000; // Update delay
    chrome.storage.local.get('articlesToExport', async (data) => {
      const articleUrls = data.articlesToExport;
      if (articleUrls && articleUrls.length > 0) {
        await exportAllArticles(articleUrls);
        chrome.storage.local.remove('articlesToExport'); // Clear stored URLs
      }
    });
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
    await new Promise(resolve => setTimeout(resolve, currentExportDelay)); // Wait for page to load
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeImageListPage' });
    if (response && response.success) {
      response.imageUrls.forEach(url => allImageUrls.add(url));
      totalPages = response.totalPages;
    } else {
      console.error(`画像一覧ページのスクレイピングに失敗しました: ${imageUrlListPage}`, response.message);
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
      await new Promise(resolve => setTimeout(resolve, currentExportDelay)); // ページロードを待つ
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleDetails' });
      if (response && response.success) {
        const { title, bodyHtml, likes, commentsCount, publishDate, tags, commentsData } = response;
        const markdownResponse = await chrome.tabs.sendMessage(tab.id, { action: 'processImagesAndConvertToMarkdown', title, htmlContent: bodyHtml, likes, commentsCount, publishDate, tags, imageMap, commentsData });
        if (markdownResponse && markdownResponse.success) {
          // Sanitize title for filename
          const sanitizedTitle = title.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();
          const filename = `${sanitizedTitle}.md`;
          zip.file(filename, markdownResponse.markdown);
          articleListMarkdown.push(`- [${title}](${filename})`);
        } else {
          console.error('Markdown変換に失敗しました:', markdownResponse.message);
        }
      }
      else {
        console.error('記事詳細の取得に失敗しました:', response.message);
      }
      await chrome.tabs.remove(tab.id);
      processedArticleCount++;
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
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  });
}