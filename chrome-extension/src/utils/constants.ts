export const URLS = {
  LODESTONE_BASE: 'https://jp.finalfantasyxiv.com',
  IMAGE_LIST_PAGE: (page: number) => `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${page}`,
  BLOG_LIST_PAGE: (characterId: string) => `https://jp.finalfantasyxiv.com/lodestone/character/${characterId}/blog/`
} as const;

export const SELECTORS = {
  BLOG_ENTRIES: 'li.entry__blog',
  BLOG_LINK: 'a.entry__blog__link',
  BLOG_TITLE: 'h2.entry__blog__title',
  BLOG_TIME: 'time span',
  BLOG_TAGS: 'div.entry__blog__tag ul li',
  BLOG_THUMBNAIL: 'div.entry__blog__img__inner img',
  
  ARTICLE_TITLE: 'h2.entry__blog__title',
  ARTICLE_BODY: 'div.txt_selfintroduction',
  ARTICLE_LIKES: '.blog__area__like__text__zero, .js__like_count',
  ARTICLE_COMMENTS_COUNT: '.entry__blog__header__comment span',
  ARTICLE_PUBLISH_DATE: '.entry__blog__header time span, time[datetime]',
  ARTICLE_TAGS: '.entry__blog__tag ul li a',
  
  PAGINATION: '.btn__pager__current',
  IMAGE_LIST: '.image__list img',
  THUMBNAIL_LIST: '.thumb_list img',
  
  COMMENT_BODIES: '.thread__comment__body',
  COMMENT_ENTRY: '.entry',
  COMMENT_AUTHOR: '.entry__name',
  COMMENT_TIMESTAMP: '.entry__time--comment'
} as const;

export const CONFIG = {
  DEFAULT_EXPORT_DELAY: 2000,
  MIN_EXPORT_DELAY: 2000,
  BASE_PAGE_LOAD_TIMEOUT: 5000,
  TIMEOUT_MULTIPLIER: 3,  // タイムアウト = アクセス間隔 × 3
  EXPERIMENTAL_MAX_PAGES: 2
} as const;

/**
 * Calculate timeout value based on user's export delay setting
 * @param exportDelay User's configured access interval
 * @returns Timeout value that respects both base timeout and user's setting
 */
export function calculateTimeout(exportDelay: number): number {
  return Math.max(CONFIG.BASE_PAGE_LOAD_TIMEOUT, exportDelay * CONFIG.TIMEOUT_MULTIPLIER);
}

export const FILE_PATTERNS = {
  THUMBNAIL_PATTERN: /_\d{2,3}_\d{2,3}(?:\.|$)/,
  INVALID_FILENAME_CHARS: /[\\/:*?"<>|]/g,
  WHITESPACE: /\s+/g
} as const;