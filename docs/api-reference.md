# API リファレンス

## 型定義

### BlogEntry

ブログ一覧から抽出されるエントリ情報。

```typescript
interface BlogEntry {
  url: string;           // 記事URL
  title: string;         // 記事タイトル
  date: string;          // 投稿日時
  tags: string[];        // タグ一覧
  thumbnail: string | null;  // サムネイルURL
}
```

### ArticleDetails

個別記事の詳細情報。

```typescript
interface ArticleDetails {
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
```

### CommentData

コメント情報。

```typescript
interface CommentData {
  author: string;
  timestamp: string;
  commentBodyHtml: string;
}
```

### ExportState

エクスポート処理の状態管理。

```typescript
interface ExportState {
  isExporting: boolean;
  showingConfirmation: boolean;
  showingProgress: boolean;
  type: 'articles' | 'images' | 'pages';
  current: number;
  total: number;
}
```

### ImageMap

画像URLからローカルパスへのマッピング。

```typescript
interface ImageMap {
  [originalUrl: string]: string;
}
```

## Chrome Message Response Types

### BaseResponse

全レスポンスの基底型。

```typescript
interface BaseResponse {
  success: boolean;
  message?: string;
}
```

### DownloadedImageInfo

ダウンロードされた画像情報。

```typescript
interface DownloadedImageInfo {
  url: string;
  filename: string;
  base64: string;
  success: boolean;
}
```

### 各種レスポンス型

```typescript
interface DownloadAllImagesResponse extends BaseResponse {
  results?: DownloadedImageInfo[];
  totalImages?: number;
}

interface GetDownloadedImageResponse extends BaseResponse {
  imageData?: DownloadedImageInfo;
}

interface FetchPageResponse extends BaseResponse {
  entries?: BlogEntry[];
  articleCount?: number;
}

interface FetchArticleResponse extends BaseResponse {
  article?: ArticleDetails;
}

interface FetchImageListPageResponse extends BaseResponse {
  imageUrls?: string[];
  totalPages?: number;
}

interface GetArticleInfoResponse extends BaseResponse {
  title?: string;
  bodyLength?: number;
  imageCount?: number;
  likes?: number;
  commentsCount?: number;
}
```

### SendResponse

chrome.runtime.sendMessageのコールバック型。

```typescript
type SendResponse<T extends BaseResponse = BaseResponse> = (response: T) => void;
```

## メッセージ型定義

### Popup Messages (Background → Popup)

```typescript
interface ShowExportConfirmationMessage {
  action: 'showExportConfirmation';
  totalArticles: number;
  isOwnBlog: boolean;
}

interface ProgressPageInfo {
  currentPage: number;
  totalPages: number;
  imageCount?: number;
}

interface UpdateProgressMessage {
  action: 'updateProgress';
  type: 'images' | 'articles' | 'pages' | 'collecting';
  current: number;
  total: number;
  pageInfo?: ProgressPageInfo;
  currentItem?: string;
}

interface ExportCompleteMessage {
  action: 'exportComplete';
}

interface ExportCancelledMessage {
  action: 'exportCancelled';
}

interface ShowErrorMessage {
  action: 'showError';
  message: string;
}

interface ExportSuccessMessage {
  action: 'exportSuccess';
  message?: string;
}

interface ArticleInfoMessage {
  action: 'articleInfo';
  title?: string;
  bodyLength?: number;
  imageCount?: number;
  likes?: number;
  commentsCount?: number;
}

// Union type
type PopupMessage =
  | ShowExportConfirmationMessage
  | UpdateProgressMessage
  | ExportCompleteMessage
  | ExportCancelledMessage
  | ShowErrorMessage
  | ExportSuccessMessage
  | ArticleInfoMessage;
```

### Content Script Messages (Background → Content)

```typescript
interface ScrapeAdditionalPageMessage {
  action: 'scrapeAdditionalPage';
}

interface GetSingleArticleDataMessage {
  action: 'getSingleArticleData';
}

interface ShowExportNotificationMessage {
  action: 'showExportNotification';
  message: string;
}

interface ExportSingleArticleMessage {
  action: 'exportSingleArticle';
}

interface ExportAllArticlesFromContentMessage {
  action: 'exportAllArticlesFromContent';
  exportDelay: number;
  currentLanguage: string;
}

interface ProcessAllArticlesFromContentMessage {
  action: 'processAllArticlesFromContent';
  entries: BlogEntry[];
  isOwnBlog: boolean;
  exportDelay: number;
  currentLanguage: string;
}

interface CancelExportMessage {
  action: 'cancelExport';
}

interface ScrapeImageListPageMessage {
  action: 'scrapeImageListPage';
}

interface GetArticleInfoMessage {
  action: 'getArticleInfo';
}

// Union type
type ContentScriptMessage =
  | ScrapeAdditionalPageMessage
  | GetSingleArticleDataMessage
  | ShowExportNotificationMessage
  | ExportSingleArticleMessage
  | ExportAllArticlesFromContentMessage
  | ProcessAllArticlesFromContentMessage
  | CancelExportMessage
  | ScrapeImageListPageMessage
  | GetArticleInfoMessage;
```

## IndexedDB API

### openDB

データベース接続を開く。

```typescript
async function openDB(): Promise<IDBDatabase>
```

### saveImage

単一画像を保存。

```typescript
interface StoredImage {
  url: string;      // キー（一意識別子）
  base64: string;   // 画像データ（base64エンコード）
  filename: string; // ファイル名
  success: boolean; // ダウンロード成功フラグ
}

async function saveImage(image: StoredImage): Promise<void>
```

### getImage

URLをキーに画像を取得。

```typescript
async function getImage(url: string): Promise<StoredImage | null>
```

### getImageCount

保存されている画像数を取得。

```typescript
async function getImageCount(): Promise<number>
```

### clearAllImages

全画像をクリア。

```typescript
async function clearAllImages(): Promise<void>
```

### deleteDatabase

データベース全体を削除。

```typescript
async function deleteDatabase(): Promise<void>
```

### saveImagesBatch

複数画像をバッチ保存。

```typescript
async function saveImagesBatch(images: StoredImage[]): Promise<void>
```

## ヘルパー関数

### generateHash

URLからユニークなファイル名を生成するためのハッシュ関数。

```typescript
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32bit整数に変換
  }
  return Math.abs(hash).toString(16);
}

// 使用例
// URL: https://example.com/image.jpg
// ハッシュ: "a1b2c3d4"
// ファイル名: "a1b2c3d4_image.jpg"
```

### sanitizeFilename

ファイルシステムで使用できない文字を置換。

```typescript
function sanitizeFilename(filename: string, maxLength = 50): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')  // 無効文字を_に置換
    .replace(/\s+/g, '_')            // 空白を_に置換
    .substring(0, maxLength);        // 最大50文字に制限
}
```

### waitForTabLoad

タブの読み込み完了を待機。

```typescript
function waitForTabLoad(tabId: number, timeout = 10000): Promise<void>
```

### sleep

指定ミリ秒待機。

```typescript
function sleep(ms: number): Promise<void>
```

## 定数

### FILE_PATTERNS

```typescript
export const FILE_PATTERNS = {
  THUMBNAIL_PATTERN: /_\d{2,3}_\d{2,3}(?:\.|$)/,  // サムネイル判定
  INVALID_FILENAME_CHARS: /[\\/:*?"<>|]/g,        // 無効文字
  WHITESPACE: /\s+/g                               // 空白文字
} as const;
```

### CONFIG

```typescript
export const CONFIG = {
  DEFAULT_EXPORT_DELAY: 2000,
  MIN_EXPORT_DELAY: 2000,
  BASE_PAGE_LOAD_TIMEOUT: 5000,
  TIMEOUT_MULTIPLIER: 3
} as const;
```

## メッセージパッシング

### Popup → Background

| アクション | 説明 |
|-----------|------|
| `exportAllArticles` | 全記事エクスポート開始 |
| `confirmExportAll` | エクスポート確認 |
| `cancelExport` | エクスポートキャンセル |
| `setExportDelay` | アクセス間隔設定 |
| `getExportState` | エクスポート状態取得 |

### Content → Background

| アクション | 説明 |
|-----------|------|
| `fetchPageInNewTab` | 新規タブでページ取得 |
| `fetchArticleInNewTab` | 新規タブで記事取得 |
| `fetchImageListPage` | 画像一覧ページ取得 |
| `downloadAllImages` | 画像ダウンロード（IndexedDB保存） |
| `getDownloadedImage` | IndexedDBから画像取得 |
| `setAllEntriesData` | 全記事データ設定 |

### Background → Content

| アクション | 説明 |
|-----------|------|
| `exportAllArticlesFromContent` | Content Script側でエクスポート実行 |
| `processAllArticlesFromContent` | 記事処理実行 |
| `scrapeImageListPage` | 画像一覧スクレイピング |
| `scrapeAdditionalPage` | 追加ページスクレイピング |
| `getSingleArticleData` | 単一記事データ取得 |
| `getArticleInfo` | 記事情報取得 |
| `cancelExport` | エクスポートキャンセル |
| `showExportNotification` | 通知表示 |

### Background → Popup

| アクション | 説明 |
|-----------|------|
| `updateProgress` | 進捗更新（Phase別） |
| `exportComplete` | エクスポート完了 |
| `exportCancelled` | エクスポートキャンセル |
| `showExportConfirmation` | 確認ダイアログ表示 |
| `showError` | エラー表示 |
| `exportSuccess` | エクスポート成功 |
| `articleInfo` | 記事情報 |
