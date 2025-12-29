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