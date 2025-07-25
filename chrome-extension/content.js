// content.js

// TurndownServiceのインスタンスを作成
const turndownService = new TurndownService();

console.log('Content script loaded on:', window.location.href);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.action === 'scrapeLodestone') {
    
    // 現在のページから記事を抽出
    const blogEntries = document.querySelectorAll('li.entry__blog');
    const extractedData = [];

    blogEntries.forEach(entry => {
      const urlElement = entry.querySelector('a.entry__blog__link');
      const titleElement = entry.querySelector('h2.entry__blog__title');
      const timeElement = entry.querySelector('time span');
      const tagsElements = entry.querySelectorAll('div.entry__blog__tag ul li');
      const thumbnailElement = entry.querySelector('div.entry__blog__img__inner img');

      const url = urlElement ? urlElement.href : null;
      const title = titleElement ? titleElement.innerText.trim() : null;
      const date = timeElement ? timeElement.innerText.trim() : null;
      const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[[\\]]/g, '').trim());
      const thumbnail = thumbnailElement ? thumbnailElement.src : null;

      extractedData.push({
        url,
        title,
        date,
        tags,
        thumbnail
      });
    });

    // ページネーション情報を取得
    let totalPages = 1;
    const paginationElement = document.querySelector('.btn__pager__current');
    if (paginationElement) {
      const paginationText = paginationElement.innerText;
      // "1ページ / 12ページ" の形式から総ページ数を抽出
      const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
      if (match && match[2]) {
        totalPages = parseInt(match[2], 10);
      }
    }

    
    // 抽出したデータと総ページ数をbackground.jsに送り返す
    chrome.runtime.sendMessage({ 
      action: 'lodestoneData', 
      data: extractedData, 
      totalPages: totalPages,
      currentPage: 1
    });
    
    // sendResponseで応答を送信
    sendResponse({ success: true, totalPages: totalPages, articleCount: extractedData.length });
  } else if (request.action === 'scrapeAdditionalPage') {
    
    // 記事を抽出（最初のページと同じロジック）
    const blogEntries = document.querySelectorAll('li.entry__blog');
    const extractedData = [];

    blogEntries.forEach(entry => {
      const urlElement = entry.querySelector('a.entry__blog__link');
      const titleElement = entry.querySelector('h2.entry__blog__title');
      const timeElement = entry.querySelector('time span');
      const tagsElements = entry.querySelectorAll('div.entry__blog__tag ul li');
      const thumbnailElement = entry.querySelector('div.entry__blog__img__inner img');

      const url = urlElement ? urlElement.href : null;
      const title = titleElement ? titleElement.innerText.trim() : null;
      const date = timeElement ? timeElement.innerText.trim() : null;
      const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[[\\]]/g, '').trim());
      const thumbnail = thumbnailElement ? thumbnailElement.src : null;

      extractedData.push({
        url,
        title,
        date,
        tags,
        thumbnail
      });
    });

    
    // 抽出したデータをbackground.jsに送り返す
    chrome.runtime.sendMessage({ 
      action: 'additionalPageData', 
      data: extractedData
    });
    
    // sendResponseで成功を通知
    sendResponse({ success: true, articleCount: extractedData.length });
  } else if (request.action === 'getArticleContent') {
    const articleContent = document.querySelector('textarea#blog__body');
    if (articleContent) {
      sendResponse({ success: true, content: articleContent.value });
    } else {
      sendResponse({ success: false, message: 'Article content not found.' });
    }
  } else if (request.action === 'getArticleDetails') {
    console.log('Processing getArticleDetails request');
    const titleElement = document.querySelector('h2.entry__blog__title');
    const bodyElement = document.querySelector('div.txt_selfintroduction');
    console.log('Found elements:', { title: !!titleElement, body: !!bodyElement });
    const likesElement = document.querySelector('.blog__area__like__text__zero, .js__like_count');
    const commentsCountElement = document.querySelector('.entry__blog__header__comment span');
    const publishDateElement = document.querySelector('.entry__blog__header time span, time[datetime]');
    const tagsElements = document.querySelectorAll('.entry__blog__tag ul li a');

    const title = titleElement ? titleElement.innerText.trim() : null;
    const bodyHtml = bodyElement ? bodyElement.innerHTML : null;
    const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
    const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
    const publishDate = publishDateElement ? (publishDateElement.getAttribute('datetime') || publishDateElement.innerText.trim()) : null;
    const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[\[\]]/g, '').trim());

    const imageUrls = [];
    if (bodyHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(bodyHtml, 'text/html');
      const imgElements = doc.querySelectorAll('img');
      imgElements.forEach(img => {
        if (img.src) {
          imageUrls.push(img.src);
        }
      });
      // サムネイル画像も追加
      const thumbnailElement = document.querySelector('.thumb_list img');
      if (thumbnailElement && thumbnailElement.getAttribute('data-origin_src')) {
        imageUrls.push(thumbnailElement.getAttribute('data-origin_src'));
      }
    }

    const commentsData = [];
    // コメントを取得
    const commentElements = document.querySelectorAll('.blog__commentarea .comment');
    commentElements.forEach(comment => {
      const authorElement = comment.querySelector('.comment__author');
      const timestampElement = comment.querySelector('.comment__date');
      const bodyElement = comment.querySelector('.comment__message');
      
      if (authorElement && bodyElement) {
        commentsData.push({
          author: authorElement.innerText.trim(),
          timestamp: timestampElement ? timestampElement.innerText.trim() : '',
          commentBodyHtml: bodyElement.innerHTML
        });
      }
    });

    if (title && bodyHtml) {
      sendResponse({ success: true, title, bodyHtml, likes, commentsCount, publishDate, tags, imageUrls, commentsData });
    } else {
      sendResponse({ success: false, message: 'Article details not found.' });
    }
  } else if (request.action === 'processImagesAndConvertToMarkdown') {
    const { title, htmlContent, likes, commentsCount, publishDate, tags, imageMap, commentsData } = request;

    // TurndownServiceのルールをカスタマイズして画像パスを置換
    turndownService.addRule('image', {
      filter: 'img',
      replacement: function (content, node) {
        const originalSrc = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        const newSrc = imageMap[originalSrc] || originalSrc; // マップに存在すれば置換、なければ元のURL
        return `![${alt}](${newSrc})`;
      }
    });

    let markdown = `---\n`;
    markdown += `title: "${title.replace(/"/g, '\"')}"\n`; // Escape double quotes in title
    if (publishDate) {
      markdown += `date: "${publishDate}"\n`;
    }
    markdown += `likes: ${likes}\n`;
    markdown += `comments: ${commentsCount}\n`;
    if (tags && tags.length > 0) {
      markdown += `tags:\n`;
      tags.forEach(tag => {
        markdown += `  - ${tag}\n`;
      });
    }
    markdown += `---\n\n`;

    markdown += turndownService.turndown(htmlContent);

    if (commentsData && commentsData.length > 0) {
      markdown += '\n\n## Comments\n\n';
      commentsData.forEach(comment => {
        markdown += `### ${comment.author} (${comment.timestamp})\n\n`;
        markdown += turndownService.turndown(comment.commentBodyHtml);
        markdown += '\n\n---\n\n'; // コメント間の区切り
      });
    }

    sendResponse({ success: true, markdown });
    return true; // Indicate that sendResponse will be called asynchronously
  } else if (request.action === 'scrapeImageListPage') {
    const imageUrls = [];
    const imageElements = document.querySelectorAll('.image__list img'); // ロドストの画像一覧ページのセレクタを想定
    imageElements.forEach(img => {
      if (img.src) {
        // サムネイル画像ではなく、元の画像URLを取得する必要がある
        // ロドストの画像一覧ページでは、img.srcがサムネイルURLになっている場合があるため、親要素のaタグのhrefを見る
        const parentLink = img.closest('a.fancybox_element');
        if (parentLink && parentLink.href) {
          imageUrls.push(parentLink.href);
        } else {
          imageUrls.push(img.src); // フォールバック
        }
      }
    });
    const totalPagesElement = document.querySelector('.btn__pager__current');
    let totalPages = 1;
    if (totalPagesElement) {
      const match = totalPagesElement.innerText.match(/\/ (\d+)ページ/);
      if (match && match[1]) {
        totalPages = parseInt(match[1], 10);
      }
    }
    sendResponse({ success: true, imageUrls, totalPages });
  } else if (request.action === 'getArticleInfo') {
    console.log('Processing getArticleInfo request');
    const titleElement = document.querySelector('h2.entry__blog__title');
    const bodyElement = document.querySelector('div.txt_selfintroduction');
    const likesElement = document.querySelector('.blog__area__like__text__zero, .js__like_count');
    const commentsCountElement = document.querySelector('.entry__blog__header__comment span');
    
    const title = titleElement ? titleElement.innerText.trim() : null;
    const bodyHtml = bodyElement ? bodyElement.innerHTML : null;
    const bodyText = bodyElement ? bodyElement.innerText.trim() : '';
    const bodyLength = bodyText.length;
    const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
    const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
    
    // 画像数を数える
    let imageCount = 0;
    if (bodyHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(bodyHtml, 'text/html');
      const imgElements = doc.querySelectorAll('img');
      imageCount = imgElements.length;
      
      // サムネイル画像も数える
      const thumbnailElement = document.querySelector('.thumb_list img');
      if (thumbnailElement && thumbnailElement.getAttribute('data-origin_src')) {
        imageCount++;
      }
    }
    
    if (title) {
      sendResponse({ success: true, title, bodyLength, imageCount, likes, commentsCount });
    } else {
      sendResponse({ success: false, message: 'Could not retrieve article information.' });
    }
  }
  return true; // 非同期処理を使用するため
});