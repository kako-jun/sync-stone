// content.js

// TurndownServiceのインスタンスを作成
const turndownService = new TurndownService();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      const match = paginationText.match(/(\d+)\s*\/\s*(\d+)/);
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
  } else if (request.action === 'getArticleContent') {
    const articleContent = document.querySelector('textarea#blog__body');
    if (articleContent) {
      sendResponse({ success: true, content: articleContent.value });
    } else {
      sendResponse({ success: false, message: '記事内容が見つかりませんでした。' });
    }
  } else if (request.action === 'getArticleDetails') {
    const titleElement = document.querySelector('h2.entry__title');
    const bodyElement = document.querySelector('div.entry__body');
    const likesElement = document.querySelector('p.like__count');
    const commentsCountElement = document.querySelector('p.comment__count');
    const publishDateElement = document.querySelector('time.entry__footer__time') || document.querySelector('time.entry__header__time') || document.querySelector('div.entry__header time');
    const tagsElements = document.querySelectorAll('div.entry__tag_list ul li') || document.querySelectorAll('div.entry__blog__tag ul li');

    const title = titleElement ? titleElement.innerText.trim() : null;
    const bodyHtml = bodyElement ? bodyElement.innerHTML : null;
    const likes = likesElement ? parseInt(likesElement.innerText.trim(), 10) : 0;
    const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
    const publishDate = publishDateElement ? publishDateElement.getAttribute('datetime') || publishDateElement.innerText.trim() : null;
    const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[[\\]]/g, '').trim());

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
    }

    const commentsData = [];
    const commentItems = document.querySelectorAll('.entry__comment__item');
    commentItems.forEach(item => {
      const authorElement = item.querySelector('.entry__comment__name');
      const timeElement = item.querySelector('.entry__comment__time');
      const bodyElement = item.querySelector('.entry__comment__body');

      const author = authorElement ? authorElement.innerText.trim() : 'Unknown';
      const timestamp = timeElement ? timeElement.innerText.trim() : '';
      const commentBodyHtml = bodyElement ? bodyElement.innerHTML : '';

      commentsData.push({
        author,
        timestamp,
        commentBodyHtml
      });
    });

    if (title && bodyHtml) {
      sendResponse({ success: true, title, bodyHtml, likes, commentsCount, publishDate, tags, imageUrls, commentsData });
    } else {
      sendResponse({ success: false, message: '記事の詳細情報が見つかりませんでした。' });
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
      markdown += '\n\n## コメント\n\n';
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
  }
});