import TurndownService from 'turndown';
import { BlogEntry, ArticleDetails, CommentData, ImageMap, ScrapingResponse, PaginationInfo } from '@/types';
import { SELECTORS } from '@/utils/constants';
import { isThumbnailImage } from '@/utils/helpers';

// Initialize TurndownService
const turndownService = new TurndownService();

interface MessageRequest {
  action: string;
  [key: string]: any;
}

interface MessageResponse {
  success: boolean;
  [key: string]: any;
}

chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
  switch (request.action) {
    case 'scrapeLodestone':
      handleScrapeLodestone(sendResponse);
      break;
    case 'scrapeAdditionalPage':
      handleScrapeAdditionalPage(sendResponse);
      break;
    case 'getArticleContent':
      handleGetArticleContent(sendResponse);
      break;
    case 'getArticleDetails':
      handleGetArticleDetails(sendResponse);
      break;
    case 'processImagesAndConvertToMarkdown':
      handleProcessImagesAndConvertToMarkdown(request, sendResponse);
      break;
    case 'scrapeImageListPage':
      handleScrapeImageListPage(sendResponse);
      break;
    case 'getArticleInfo':
      handleGetArticleInfo(sendResponse);
      break;
    case 'showExportNotification':
      showExportNotification(request.message);
      break;
  }
  return true; // Indicates async response
});

function handleScrapeLodestone(sendResponse: (response: MessageResponse) => void): void {
  const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
  const extractedData: BlogEntry[] = [];

  blogEntries.forEach(entry => {
    const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
    const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
    const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
    const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
    const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

    const url = urlElement?.href || '';
    const title = titleElement?.innerText.trim() || '';
    const date = timeElement?.innerText.trim() || '';
    const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[\[\]]/g, '').trim());
    const thumbnail = thumbnailElement?.src || null;

    extractedData.push({ url, title, date, tags, thumbnail });
  });

  // Get pagination info
  let totalPages = 1;
  const paginationElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
  if (paginationElement) {
    const paginationText = paginationElement.innerText;
    const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
    if (match?.[2]) {
      totalPages = parseInt(match[2], 10);
    }
  }

  chrome.runtime.sendMessage({
    action: 'lodestoneData',
    data: extractedData,
    totalPages,
    currentPage: 1
  });

  sendResponse({ success: true, totalPages, articleCount: extractedData.length });
}

function handleScrapeAdditionalPage(sendResponse: (response: MessageResponse) => void): void {
  const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
  const extractedData: BlogEntry[] = [];

  blogEntries.forEach(entry => {
    const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
    const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
    const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
    const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
    const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

    const url = urlElement?.href || '';
    const title = titleElement?.innerText.trim() || '';
    const date = timeElement?.innerText.trim() || '';
    const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[\[\]]/g, '').trim());
    const thumbnail = thumbnailElement?.src || null;

    extractedData.push({ url, title, date, tags, thumbnail });
  });

  chrome.runtime.sendMessage({
    action: 'additionalPageData',
    data: extractedData
  });

  sendResponse({ success: true, articleCount: extractedData.length });
}

function handleGetArticleContent(sendResponse: (response: MessageResponse) => void): void {
  const articleContent = document.querySelector('textarea#blog__body') as HTMLTextAreaElement;
  if (articleContent) {
    sendResponse({ success: true, content: articleContent.value });
  } else {
    sendResponse({ success: false, message: 'Article content not found.' });
  }
}

function handleGetArticleDetails(sendResponse: (response: MessageResponse) => void): void {
  const titleElement = document.querySelector(SELECTORS.ARTICLE_TITLE) as HTMLElement;
  const bodyElement = document.querySelector(SELECTORS.ARTICLE_BODY) as HTMLElement;
  const likesElement = document.querySelector(SELECTORS.ARTICLE_LIKES) as HTMLElement;
  const commentsCountElement = document.querySelector(SELECTORS.ARTICLE_COMMENTS_COUNT) as HTMLElement;
  const publishDateElement = document.querySelector(SELECTORS.ARTICLE_PUBLISH_DATE) as HTMLElement;
  const tagsElements = document.querySelectorAll(SELECTORS.ARTICLE_TAGS);

  const title = titleElement?.innerText.trim() || null;
  const bodyHtml = bodyElement?.innerHTML || null;
  const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
  const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
  const publishDate = publishDateElement ? 
    (publishDateElement.getAttribute('datetime') || publishDateElement.innerText.trim()) : null;
  const tags = Array.from(tagsElements).map(tag => tag.innerText.replace(/[\[\]]/g, '').trim());

  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];

  // Get thumbnail images
  const thumbnailElements = document.querySelectorAll(SELECTORS.THUMBNAIL_LIST);
  thumbnailElements.forEach(img => {
    const thumbnailImg = img as HTMLImageElement;
    const originalSrc = thumbnailImg.getAttribute('data-origin_src');
    if (originalSrc) {
      thumbnailUrls.push(originalSrc);
      imageUrls.push(originalSrc);
    }
  });

  // Get images from article body
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

  // Get comments
  const commentsData: CommentData[] = [];
  const commentBodies = document.querySelectorAll(SELECTORS.COMMENT_BODIES);

  commentBodies.forEach(bodyElement => {
    const entryElement = bodyElement.previousElementSibling;
    if (entryElement?.classList.contains('entry')) {
      const authorElement = entryElement.querySelector(SELECTORS.COMMENT_AUTHOR) as HTMLElement;
      const timestampElement = entryElement.querySelector(SELECTORS.COMMENT_TIMESTAMP) as HTMLElement;

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
}

function handleProcessImagesAndConvertToMarkdown(
  request: MessageRequest, 
  sendResponse: (response: MessageResponse) => void
): void {
  const { title, htmlContent, likes, commentsCount, publishDate, tags, imageMap, thumbnailUrls, commentsData } = request;

  // Customize TurndownService rules for image path replacement
  turndownService.addRule('image', {
    filter: 'img',
    replacement: function (content: string, node: any) {
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

  // Add thumbnail images at the beginning
  if (thumbnailUrls && thumbnailUrls.length > 0) {
    thumbnailUrls.forEach((thumbnailUrl: string) => {
      const localPath = imageMap[thumbnailUrl] || thumbnailUrl;
      markdown += `![](${localPath})\n\n`;
    });
  }

  markdown += turndownService.turndown(htmlContent);

  // Add comments section
  if (commentsData && commentsData.length > 0) {
    markdown += '\n\n## Comments\n\n';
    commentsData.forEach((comment: CommentData) => {
      markdown += `### ${comment.author} (${comment.timestamp})\n\n`;
      markdown += turndownService.turndown(comment.commentBodyHtml);
      markdown += '\n\n---\n\n';
    });
  }

  sendResponse({ success: true, markdown });
}

function handleScrapeImageListPage(sendResponse: (response: MessageResponse) => void): void {
  const imageUrls: string[] = [];
  const imageElements = document.querySelectorAll(SELECTORS.IMAGE_LIST);

  imageElements.forEach(img => {
    const imgElement = img as HTMLImageElement;
    if (imgElement.src) {
      const parentLink = imgElement.closest('a') as HTMLAnchorElement;

      if (parentLink?.href) {
        imageUrls.push(parentLink.href);
      } else if (!isThumbnailImage(imgElement.src)) {
        imageUrls.push(imgElement.src);
      }
    }
  });

  const totalPagesElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
  let totalPages = 1;
  if (totalPagesElement) {
    const match = totalPagesElement.innerText.match(/\/ (\d+)ページ/);
    if (match?.[1]) {
      totalPages = parseInt(match[1], 10);
    }
  }

  sendResponse({ success: true, imageUrls, totalPages });
}

function handleGetArticleInfo(sendResponse: (response: MessageResponse) => void): void {
  const titleElement = document.querySelector(SELECTORS.ARTICLE_TITLE) as HTMLElement;
  const bodyElement = document.querySelector(SELECTORS.ARTICLE_BODY) as HTMLElement;
  const likesElement = document.querySelector(SELECTORS.ARTICLE_LIKES) as HTMLElement;
  const commentsCountElement = document.querySelector(SELECTORS.ARTICLE_COMMENTS_COUNT) as HTMLElement;

  const title = titleElement?.innerText.trim() || null;
  const bodyHtml = bodyElement?.innerHTML || null;
  const bodyText = bodyElement?.innerText.trim() || '';
  const bodyLength = bodyText.length;
  const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
  const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;

  // Count images
  let imageCount = 0;
  if (bodyHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyHtml, 'text/html');
    const imgElements = doc.querySelectorAll('img');
    imageCount = imgElements.length;

    // Count thumbnail images
    const thumbnailElement = document.querySelector(SELECTORS.THUMBNAIL_LIST) as HTMLImageElement;
    if (thumbnailElement?.getAttribute('data-origin_src')) {
      imageCount++;
    }
  }

  if (title) {
    sendResponse({ success: true, title, bodyLength, imageCount, likes, commentsCount });
  } else {
    sendResponse({ success: false, message: 'Could not retrieve article information.' });
  }
}

/**
 * Show export notification banner
 */
function showExportNotification(message: string): void {
  // Remove existing notification if any
  const existingNotification = document.getElementById('sync-stone-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification banner
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

  // Add animation CSS
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

  // Add click to dismiss
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideDown 0.3s ease-in reverse';
    setTimeout(() => notification.remove(), 300);
  });

  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideDown 0.3s ease-in reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 8000);

  document.body.insertBefore(notification, document.body.firstChild);
}