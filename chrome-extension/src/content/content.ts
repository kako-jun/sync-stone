// content.ts - 元のJSと同じ構造を維持

// TurndownServiceのインスタンスを作成（グローバル変数として利用可能と仮定）
declare const TurndownService: any;
const turndownService = new TurndownService();

// セレクタ定数
const SELECTORS = {
  BLOG_ENTRIES: 'li.entry__blog',
  BLOG_LINK: 'a.entry__blog__link',
  BLOG_TITLE: 'h2.entry__blog__title',
  BLOG_TIME: 'time span',
  BLOG_TAGS: 'div.entry__blog__tag ul li',
  BLOG_THUMBNAIL: 'div.entry__blog__img__inner img',
  PAGINATION: '.btn__pager__current',
  ARTICLE_TITLE: 'h2.entry__title',
  ARTICLE_BODY: 'div.entry__body',
  ARTICLE_LIKES: 'p.like__count',
  ARTICLE_COMMENTS_COUNT: 'p.comment__count',
  ARTICLE_PUBLISH_DATE: 'time.entry__footer__time',
  ARTICLE_TAGS: '.entry__blog__tag',
  THUMBNAIL_LIST: '.ldst__blog .entry__blog__ic--img img',
  COMMENT_BODIES: '.ldst__comment .comment__text',
  COMMENT_AUTHOR: '.comment__character .character__name',
  COMMENT_TIMESTAMP: '.comment__time time',
  IMAGE_LIST: '.entry__blog__image_list img'
};

// ヘルパー関数
function isThumbnailImage(src: string): boolean {
  return src.includes('_s.jpg') || src.includes('_s.png') || src.includes('_s.webp');
}


chrome.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
  
  if (request.action === 'scrapeLodestone') {
    const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
    const extractedData: any[] = [];

    blogEntries.forEach(entry => {
      const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
      const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
      const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
      const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
      const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

      const url = urlElement?.href || '';
      const title = titleElement?.innerText.trim() || '';
      const date = timeElement?.innerText.trim() || '';
      const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());
      const thumbnail = thumbnailElement?.src || null;

      extractedData.push({ url, title, date, tags, thumbnail });
    });

    // ページネーション情報を取得
    let totalPages = 1;
    const paginationElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
    if (paginationElement) {
      const paginationText = paginationElement.innerText;
      const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
      if (match?.[2]) {
        totalPages = parseInt(match[2], 10);
      }
    }

    // 自分/他人ブログ判定
    const isOwnBlog = detectOwnBlog();

    chrome.runtime.sendMessage({
      action: 'lodestoneData',
      data: extractedData,
      totalPages,
      currentPage: 1,
      isOwnBlog
    });

    sendResponse({ success: true, data: extractedData, totalPages, articleCount: extractedData.length, isOwnBlog });
    
  } else if (request.action === 'scrapeAdditionalPage') {
    const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
    const extractedData: any[] = [];

    blogEntries.forEach(entry => {
      const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
      const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
      const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
      const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
      const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

      const url = urlElement?.href || '';
      const title = titleElement?.innerText.trim() || '';
      const date = timeElement?.innerText.trim() || '';
      const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());
      const thumbnail = thumbnailElement?.src || null;

      extractedData.push({ url, title, date, tags, thumbnail });
    });

    chrome.runtime.sendMessage({
      action: 'additionalPageData',
      data: extractedData
    });

    sendResponse({ success: true, data: extractedData, articleCount: extractedData.length });
    
  } else if (request.action === 'getArticleContent') {
    const articleContent = document.querySelector('textarea#blog__body') as HTMLTextAreaElement;
    if (articleContent) {
      sendResponse({ success: true, content: articleContent.value });
    } else {
      sendResponse({ success: false, message: 'Article content not found.' });
    }
    
  } else if (request.action === 'getArticleDetails' || request.action === 'getSingleArticleData') {
    const titleElement = document.querySelector('h2.entry__blog__title') as HTMLElement;
    const bodyElement = document.querySelector('div.txt_selfintroduction') as HTMLElement;
    const likesElement = document.querySelector('.blog__area__like__text__zero, .js__like_count') as HTMLElement;
    const commentsCountElement = document.querySelector('.entry__blog__header__comment span') as HTMLElement;
    const publishDateElement = document.querySelector('.entry__blog__header time span, time[datetime]');
    const tagsElements = document.querySelectorAll('.entry__blog__tag ul li a');

    const title = titleElement?.innerText.trim() || null;
    const bodyHtml = bodyElement?.innerHTML || null;
    const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
    const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
    const publishDate = publishDateElement ? 
      (publishDateElement.getAttribute('datetime') || (publishDateElement as HTMLElement).innerText.trim()) : null;
    const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());

    const imageUrls: string[] = [];
    const thumbnailUrls: string[] = [];

    // サムネイル画像の取得
    const thumbnailElements = document.querySelectorAll('.thumb_list img');
    thumbnailElements.forEach(img => {
      const thumbnailImg = img as HTMLImageElement;
      const originalSrc = thumbnailImg.getAttribute('data-origin_src');
      if (originalSrc) {
        thumbnailUrls.push(originalSrc);
        imageUrls.push(originalSrc);
      }
    });

    // 記事本文中の画像を取得
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

    // コメントの取得
    const commentsData: any[] = [];
    const commentBodies = document.querySelectorAll('.thread__comment__body');

    commentBodies.forEach(bodyElement => {
      const entryElement = bodyElement.previousElementSibling;
      if (entryElement?.classList.contains('entry')) {
        const authorElement = entryElement.querySelector('.entry__name') as HTMLElement;
        const timestampElement = entryElement.querySelector('.entry__time--comment') as HTMLElement;

        if (authorElement && bodyElement) {
          commentsData.push({
            author: authorElement.innerText.trim(),
            timestamp: timestampElement?.innerText.trim() || '',
            commentBodyHtml: (bodyElement as HTMLElement).innerHTML
          });
        }
      }
    });

    if (title && bodyHtml) {
      sendResponse({
        success: true,
        title,
        bodyHtml,
        likes,
        commentsCount,
        publishDate,
        tags,
        imageUrls,
        thumbnailUrls,
        commentsData
      });
    } else {
      sendResponse({ success: false, message: 'Article details not found.' });
    }
    
  } else if (request.action === 'processImagesAndConvertToMarkdown') {
    const { title, htmlContent, likes, commentsCount, publishDate, tags, imageMap, thumbnailUrls, commentsData } = request;

    // TurndownServiceのルールをカスタマイズして画像パスを置換
    turndownService.addRule('image', {
      filter: 'img',
      replacement: function (_content: string, node: any) {
        const originalSrc = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        const newSrc = imageMap[originalSrc] || originalSrc;
        return `![${alt}](${newSrc})`;
      }
    });

    let markdown = `---\n`;
    markdown += `title: "${title.replace(/"/g, '\\"')}"\n`;
    if (publishDate) {
      markdown += `date: "${publishDate}"\n`;
    }
    markdown += `likes: ${likes}\n`;
    markdown += `comments: ${commentsCount}\n`;
    if (tags && tags.length > 0) {
      markdown += `tags:\n`;
      tags.forEach((tag: string) => {
        markdown += `  - ${tag}\n`;
      });
    }
    markdown += `---\n\n`;

    // サムネイル画像を最初に追加
    if (thumbnailUrls && thumbnailUrls.length > 0) {
      thumbnailUrls.forEach((thumbnailUrl: string) => {
        const localPath = imageMap[thumbnailUrl] || thumbnailUrl;
        markdown += `![](${localPath})\n\n`;
      });
    }

    markdown += turndownService.turndown(htmlContent);

    // コメントセクションの追加
    if (commentsData && commentsData.length > 0) {
      markdown += '\n\n## Comments\n\n';
      commentsData.forEach((comment: any) => {
        markdown += `### ${comment.author} (${comment.timestamp})\n\n`;
        markdown += turndownService.turndown(comment.commentBodyHtml);
        markdown += '\n\n---\n\n';
      });
    }

    sendResponse({ success: true, markdown });
    
  } else if (request.action === 'scrapeImageListPage') {
    const imageUrls: string[] = [];
    const imageElements = document.querySelectorAll('.image__list img');

    imageElements.forEach(img => {
      const imgElement = img as HTMLImageElement;
      if (imgElement.src) {
        const parentLink = imgElement.closest('a.fancybox_element') as HTMLAnchorElement;
        if (parentLink?.href) {
          imageUrls.push(parentLink.href);
        } else {
          imageUrls.push(imgElement.src);
        }
      }
    });

    const totalPagesElement = document.querySelector('.btn__pager__current') as HTMLElement;
    let totalPages = 1;
    if (totalPagesElement) {
      const match = totalPagesElement.innerText.match(/\/ (\d+)ページ/);
      if (match?.[1]) {
        totalPages = parseInt(match[1], 10);
      }
    }

    sendResponse({ success: true, imageUrls, totalPages });
    
  } else if (request.action === 'getArticleInfo') {
    const titleElement = document.querySelector('h2.entry__blog__title') as HTMLElement;
    const bodyElement = document.querySelector('div.txt_selfintroduction') as HTMLElement;
    const likesElement = document.querySelector('.blog__area__like__text__zero, .js__like_count') as HTMLElement;
    const commentsCountElement = document.querySelector('.entry__blog__header__comment span') as HTMLElement;

    const title = titleElement?.innerText.trim() || null;
    const bodyHtml = bodyElement?.innerHTML || null;
    const bodyText = bodyElement?.innerText.trim() || '';
    const bodyLength = bodyText.length;
    const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
    const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;

    // 画像数をカウント
    let imageCount = 0;
    if (bodyHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(bodyHtml, 'text/html');
      const imgElements = doc.querySelectorAll('img');
      imageCount = imgElements.length;

      // サムネイル画像もカウント
      const thumbnailElement = document.querySelector('.thumb_list img') as HTMLImageElement;
      if (thumbnailElement?.getAttribute('data-origin_src')) {
        imageCount++;
      }
    }

    if (title) {
      sendResponse({ success: true, title, bodyLength, imageCount, likes, commentsCount });
    } else {
      sendResponse({ success: false, message: 'Could not retrieve article information.' });
    }
    
  } else if (request.action === 'showExportNotification') {
    showExportNotification(request.message);
    
  } else if (request.action === 'exportAllArticlesFromContent') {
    // 全記事エクスポート処理をコンテンツスクリプトで実行
    handleAllArticlesExportFromContent(request.exportDelay, request.isDeveloperMode, request.currentLanguage);
    sendResponse({ success: true });
    
  } else if (request.action === 'processAllArticlesFromContent') {
    // 確認後の記事処理を実行
    processAllArticlesFromContent(request.entries, request.isOwnBlog, request.exportDelay, request.currentLanguage);
    sendResponse({ success: true });
  }

  return true; // 非同期レスポンスを示す
});

/**
 * エクスポート通知バナーを表示
 */
function showExportNotification(message: string): void {
  // 既存の通知があれば削除
  const existingNotification = document.getElementById('sync-stone-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // 通知バナーを作成
  const notification = document.createElement('div');
  notification.id = 'sync-stone-notification';
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideDown 0.5s ease-out;
    border-bottom: 3px solid #ffd700;
  `;

  // アニメーションCSSを追加
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    #sync-stone-notification {
      animation: slideDown 0.5s ease-out, pulse 2s infinite 1s;
    }
  `;
  document.head.appendChild(style);

  notification.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
      <span style="font-size: 20px;">📋</span>
      <span>${message}</span>
      <span style="font-size: 20px;">📥</span>
    </div>
  `;

  // クリックで非表示
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideDown 0.3s ease-in reverse';
    setTimeout(() => notification.remove(), 300);
  });

  // 8秒後に自動非表示
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideDown 0.3s ease-in reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);

  document.body.insertBefore(notification, document.body.firstChild);
}

/**
 * 全記事エクスポート処理をコンテンツスクリプトで実行
 */
async function handleAllArticlesExportFromContent(exportDelay: number, isDeveloperMode: boolean, currentLanguage: string): Promise<void> {
  try {
    // 1. 現在のページから記事一覧を取得
    const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
    const extractedData: any[] = [];

    blogEntries.forEach(entry => {
      const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
      const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
      const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
      const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
      const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

      const url = urlElement?.href || '';
      const title = titleElement?.innerText.trim() || '';
      const date = timeElement?.innerText.trim() || '';
      const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());
      const thumbnail = thumbnailElement?.src || null;

      extractedData.push({ url, title, date, tags, thumbnail });
    });

    // 2. ページネーション情報を取得
    let totalPages = 1;
    const paginationElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
    if (paginationElement) {
      const paginationText = paginationElement.innerText;
      const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
      if (match?.[2]) {
        totalPages = parseInt(match[2], 10);
      }
    }

    const isOwnBlog = detectOwnBlog();
    
    // 3. 追加ページがある場合は取得
    const allEntries = [...extractedData];
    if (totalPages > 1) {
      for (let page = 2; page <= totalPages; page++) {
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0];
        const pageUrl = `${baseUrl}?page=${page}`;
        
        try {
          const additionalEntries = await fetchPageEntries(pageUrl, exportDelay);
          allEntries.push(...additionalEntries);
          
          // 進捗更新
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            type: 'pages',
            current: page,
            total: totalPages,
            pageInfo: { currentPage: page, totalPages }
          });
        } catch (error) {
          // Failed to fetch page - continue with available entries
        }
      }
    }

    // 4. 開発者モードの場合は5件に制限
    let processEntries = allEntries;
    if (isDeveloperMode && allEntries.length > 5) {
      processEntries = allEntries.slice(0, 5);
    }

    // 5. 確認ダイアログを表示（自分/他人の区別も表示）
    const displayCount = processEntries.length;
    chrome.runtime.sendMessage({
      action: 'showExportConfirmation',
      totalArticles: displayCount,
      isOwnBlog
    });

    // 6. 確認後の処理は背景スクリプトから再度呼び出される
    chrome.runtime.sendMessage({
      action: 'setAllEntriesData',
      entries: processEntries,
      isOwnBlog,
      exportDelay,
      isDeveloperMode,
      currentLanguage
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'showError',
      message: 'エクスポート処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

/**
 * 指定ページの記事一覧を取得
 */
async function fetchPageEntries(pageUrl: string, delay: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // 新しいタブでページを開いて記事一覧を取得
    chrome.runtime.sendMessage({
      action: 'fetchPageInNewTab',
      url: pageUrl,
      delay
    }, (response) => {
      if (response?.success) {
        resolve(response.entries || []);
      } else {
        reject(new Error(response?.message || 'Failed to fetch page entries'));
      }
    });
  });
}

/**
 * 確認後の記事処理を実行
 */
async function processAllArticlesFromContent(entries: any[], isOwnBlog: boolean, exportDelay: number, currentLanguage: string): Promise<void> {
  try {
    const allArticles: any[] = [];
    const imageUrls = new Set<string>();

    // 各記事の詳細データを取得
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      try {
        const articleDetails = await fetchArticleDetails(entry.url, exportDelay);
        allArticles.push(articleDetails);
        
        // 画像URLを収集（重複チェック付き）
        if (articleDetails.imageUrls) {
          articleDetails.imageUrls.forEach((url: string) => imageUrls.add(url));
        }
        if (articleDetails.thumbnailUrls) {
          articleDetails.thumbnailUrls.forEach((url: string) => imageUrls.add(url));
        }

        // 進捗更新
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          type: 'articles',
          current: i + 1,
          total: entries.length,
          currentItem: articleDetails.title
        });

      } catch (error) {
        // Failed to fetch article - continue with available articles
      }
    }

    // 最終的なZIP作成を背景スクリプトに依頼
    chrome.runtime.sendMessage({
      action: 'createFinalZip',
      articles: allArticles,
      imageUrls: Array.from(imageUrls),
      isOwnBlog,
      currentLanguage
    });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'showError',
      message: '記事処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error))
    });
  }
}

/**
 * 指定URLの記事詳細を取得
 */
async function fetchArticleDetails(articleUrl: string, delay: number): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'fetchArticleInNewTab',
      url: articleUrl,
      delay
    }, (response) => {
      if (response?.success) {
        resolve(response.article);
      } else {
        reject(new Error(response?.message || 'Failed to fetch article details'));
      }
    });
  });
}

/**
 * 自分のブログか他人のブログかを判定
 */
function detectOwnBlog(): boolean {
  // 1. GTM変数による判定（最も信頼性が高い）
  if (typeof window !== 'undefined' && (window as any).ldst_gtm_variable) {
    const gtmVariable = (window as any).ldst_gtm_variable;
    if (gtmVariable.mychara === 'notmychara') {
      return false;
    }
    if (gtmVariable.mychara === 'mychara') {
      return true;
    }
  }
  
  // 2. DOM要素による判定
  // 自分のブログ専用の要素をチェック（ブログ作成ボタンなど）
  const createBlogButton = document.querySelector('a[href*="/blog/add"]');
  const editButton = document.querySelector('a[href*="/blog/edit"]');
  
  if (createBlogButton || editButton) {
    return true;
  }
  
  // 他人のブログ専用の要素をチェック
  const othersViewElement = document.querySelector('.entry__blog__view--others');
  if (othersViewElement) {
    return false;
  }
  
  // 3. URLパターンによる特殊ケース判定
  const currentUrl = window.location.href;
  // マイページ系のURLは自分のブログ
  if (currentUrl.includes('/lodestone/my/')) {
    return true;
  }
  
  // 4. デフォルトは自分のブログ（自分のブログ一覧の方が一般的）
  return true;
}