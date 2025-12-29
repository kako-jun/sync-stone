export interface BlogEntry {
  url: string;
  title: string;
  date: string;
  tags: string[];
  thumbnail: string | null;
}

export interface ArticleDetails {
  title: string | null;
  bodyHtml: string | null;
  likes: number;
  commentsCount: number;
  publishDate: string | null;
  tags: string[];
  imageUrls: string[];
  thumbnailUrls: string[];
  commentsData: CommentData[];
}

export interface CommentData {
  author: string;
  timestamp: string;
  commentBodyHtml: string;
}

export interface ExportState {
  isExporting: boolean;
  showingConfirmation: boolean;
  showingProgress: boolean;
  type: 'articles' | 'images' | 'pages';
  current: number;
  total: number;
}

export interface ImageMap {
  [originalUrl: string]: string;
}

export interface ScrapingResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginationInfo {
  totalPages: number;
  currentPage: number;
}

// Chrome message response types
export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface DownloadedImageInfo {
  url: string;
  filename: string;
  base64: string;
  success: boolean;
}

export interface DownloadAllImagesResponse extends BaseResponse {
  results?: DownloadedImageInfo[];
  totalImages?: number;
}

export interface GetDownloadedImageResponse extends BaseResponse {
  imageData?: DownloadedImageInfo;
}

export interface FetchPageResponse extends BaseResponse {
  entries?: BlogEntry[];
  articleCount?: number;
}

export interface FetchArticleResponse extends BaseResponse {
  article?: ArticleDetails;
}

export interface ProcessedArticleData {
  sanitizedTitle: string;
  markdownContent: string;
  originalTitle: string;
  imageUrls: string[];
}

export interface FetchImageListPageResponse extends BaseResponse {
  imageUrls?: string[];
  totalPages?: number;
}

// Chrome message sender callback types
export type SendResponse<T extends BaseResponse = BaseResponse> = (response: T) => void;

// Popup message types
export interface ShowExportConfirmationMessage {
  action: 'showExportConfirmation';
  totalArticles: number;
  isOwnBlog: boolean;
}

export interface ProgressPageInfo {
  currentPage: number;
  totalPages: number;
  imageCount?: number;
}

export interface UpdateProgressMessage {
  action: 'updateProgress';
  type: 'images' | 'articles' | 'pages' | 'collecting';
  current: number;
  total: number;
  pageInfo?: ProgressPageInfo;
  currentItem?: string;
}

export interface ExportCompleteMessage {
  action: 'exportComplete';
}

export interface ShowErrorMessage {
  action: 'showError';
  message: string;
}

export interface ExportSuccessMessage {
  action: 'exportSuccess';
  message?: string;
}

export interface ArticleInfoMessage {
  action: 'articleInfo';
  title?: string;
  bodyLength?: number;
  imageCount?: number;
  likes?: number;
  commentsCount?: number;
}

export type PopupMessage =
  | ShowExportConfirmationMessage
  | UpdateProgressMessage
  | ExportCompleteMessage
  | ShowErrorMessage
  | ExportSuccessMessage
  | ArticleInfoMessage;

// Article info response from content script
export interface GetArticleInfoResponse extends BaseResponse {
  title?: string;
  bodyLength?: number;
  imageCount?: number;
  likes?: number;
  commentsCount?: number;
}