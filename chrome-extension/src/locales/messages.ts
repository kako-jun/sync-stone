// Centralized i18n messages for SyncStone Chrome Extension
// This file is the single source of truth for all UI messages

export type SupportedLanguage = 'ja' | 'en';

export interface Messages {
  // Extension info
  extensionName: string;
  lodestoneExportDescription: string;

  // Settings
  accessIntervalLabel: string;

  // Buttons
  exportAllArticlesButton: string;
  exportAllArticlesButtonFirstPage: string;
  exportCurrentArticleButton: string;
  yesButton: string;
  noButton: string;
  cancelExport: string;

  // Confirmation dialog
  confirmationText: string;
  confirmationOwnBlog: string;
  confirmationOthersBlog: string;

  // Progress messages
  downloadingImages: string;
  exportingArticles: string;
  exportComplete: string;
  startingExport: string;
  startingDownload: string;
  exportCancelled: string;
  collectingArticles: string;
  imageDownloadHeader: string;
  articleProcessHeader: string;
  imageDownloadComplete: string;
  articleProcessComplete: string;
  completed: string;

  // Success/Error messages
  singleArticleExported: string;
  failedToExportArticle: string;
  failedToExport: string;
  couldNotRetrieveTitle: string;
  contentScriptNotAvailable: string;
  notOnBlogListPageError: string;
  connectionError: string;

  // Guidance
  guidanceTitle: string;
  guidanceDetails: string;
  guidanceLinkText: string;

  // Article info
  articleInfoHeader: string;
  articleTitle: string;
  articleBody: string;
  articleImages: string;
  articleLikes: string;
  articleComments: string;
  chars: string;
  件: string;

  // Background script messages
  blogListMoved: string;
  exportDataNotFound: string;

  // Content script messages
  noArticlesToExport: string;
  articleDataNotFound: string;
  markdownConversionFailed: string;
  exportProcessError: string;
  articleProcessError: string;

  // Warning messages
  doNotClosePopup: string;

  // Progress format strings
  progressPage: string;
  progressArticleCount: string;
  progressImageCount: string;
  progressArticles: string;
  progressImages: string;
  collectingImageList: string;
}

export const messages: Record<SupportedLanguage, Messages> = {
  ja: {
    // Extension info
    extensionName: 'SyncStone - 星紡のメモワール',
    lodestoneExportDescription: 'ロドストの記事を、Markdown形式でエクスポートします。',

    // Settings
    accessIntervalLabel: 'アクセス間隔:',

    // Buttons
    exportAllArticlesButton: '☄ すべての記事をエクスポート',
    exportAllArticlesButtonFirstPage: '1ページ目へ移動 → すべての記事をエクスポート',
    exportCurrentArticleButton: '☄ この記事をエクスポート',
    yesButton: 'はい',
    noButton: 'いいえ',
    cancelExport: '⛔ エクスポートをキャンセル',

    // Confirmation dialog
    confirmationText: '件の記事が見つかりました。エクスポートしますか？',
    confirmationOwnBlog: '（自分の記事）',
    confirmationOthersBlog: '（自分以外の記事）',

    // Progress messages
    downloadingImages: '画像をエクスポート中',
    exportingArticles: '記事をエクスポート中',
    exportComplete: 'エクスポート完了！',
    startingExport: 'エクスポート中です...',
    startingDownload: 'エクスポート中です...',
    exportCancelled: 'エクスポートをキャンセルしました',
    collectingArticles: '記事数を収集中',
    imageDownloadHeader: '🖼️ 画像エクスポート',
    articleProcessHeader: '📝 記事エクスポート',
    imageDownloadComplete: '画像エクスポート完了',
    articleProcessComplete: '記事エクスポート完了',
    completed: '完了',

    // Success/Error messages
    singleArticleExported: '記事がエクスポートされました！',
    failedToExportArticle: 'エクスポートに失敗しました: ',
    failedToExport: 'エクスポートに失敗しました: ',
    couldNotRetrieveTitle: '取得できませんでした',
    contentScriptNotAvailable: 'ページをリロードしてから再度お試しください。',
    notOnBlogListPageError: 'ロドストの日記ページで実行してください。',
    connectionError: '接続を確立できませんでした。受信側が存在しません。',

    // Guidance
    guidanceTitle: 'ロドストのブログページに移動してください',
    guidanceDetails: '• 記事一覧ページ → 全記事エクスポート<br>• 個別記事ページ → 個別 + 全記事エクスポート',
    guidanceLinkText: 'ロドストにアクセス',

    // Article info
    articleInfoHeader: '記事情報',
    articleTitle: 'タイトル: ',
    articleBody: '本文: ',
    articleImages: '画像: ',
    articleLikes: 'いいね: ',
    articleComments: 'コメント: ',
    chars: '文字',
    件: '件',

    // Background script messages
    blogListMoved: 'ブログ一覧ページに移動しました。全記事エクスポートボタンをもう一度押してください。',
    exportDataNotFound: 'エクスポート用のデータが見つかりません',

    // Content script messages
    noArticlesToExport: 'エクスポートする記事がありません。',
    articleDataNotFound: '記事データを取得できませんでした',
    markdownConversionFailed: 'Markdownへの変換に失敗しました',
    exportProcessError: 'エクスポート処理中にエラーが発生しました: ',
    articleProcessError: 'エクスポート処理中にエラーが発生しました: ',

    // Warning messages
    doNotClosePopup: '⚠️ エクスポート中です。ポップアップを閉じずにそのままお待ちください。',

    // Progress format strings
    progressPage: 'ページ',
    progressArticleCount: '記事数',
    progressImageCount: '画像数',
    progressArticles: '記事',
    progressImages: '画像',
    collectingImageList: '画像一覧を収集中',
  },
  en: {
    // Extension info
    extensionName: 'SyncStone - Stardustmemoir',
    lodestoneExportDescription: 'Export your Lodestone diary entries in Markdown format.',

    // Settings
    accessIntervalLabel: 'Access Interval:',

    // Buttons
    exportAllArticlesButton: 'Export All Articles',
    exportAllArticlesButtonFirstPage: 'Go to Page 1 and Export All',
    exportCurrentArticleButton: 'Export Current Article',
    yesButton: 'Yes',
    noButton: 'No',
    cancelExport: '⛔ Cancel Export',

    // Confirmation dialog
    confirmationText: ' articles will be exported. Continue?',
    confirmationOwnBlog: '(Your Articles)',
    confirmationOthersBlog: "(Others' Articles)",

    // Progress messages
    downloadingImages: 'Exporting Images',
    exportingArticles: 'Exporting Articles',
    exportComplete: 'Export Complete!',
    startingExport: 'Exporting...',
    startingDownload: 'Exporting...',
    exportCancelled: 'Export cancelled',
    collectingArticles: 'Collecting Articles',
    imageDownloadHeader: '🖼️ Exporting Images',
    articleProcessHeader: '📝 Exporting Articles',
    imageDownloadComplete: 'Image export complete',
    articleProcessComplete: 'Article export complete',
    completed: 'Complete',

    // Success/Error messages
    singleArticleExported: 'Single article exported successfully!',
    failedToExportArticle: 'Failed to export: ',
    failedToExport: 'Failed to export: ',
    couldNotRetrieveTitle: 'Could not retrieve',
    contentScriptNotAvailable: 'Please reload the page and try again.',
    notOnBlogListPageError: 'Please run this on a Lodestone blog page.',
    connectionError: 'Could not establish connection. Receiving end does not exist.',

    // Guidance
    guidanceTitle: 'Please navigate to a Lodestone blog page',
    guidanceDetails: '• Blog list page → Export all articles<br>• Individual article page → Individual + Export all',
    guidanceLinkText: 'Go to Lodestone',

    // Article info
    articleInfoHeader: 'Article Info',
    articleTitle: 'Title: ',
    articleBody: 'Body: ',
    articleImages: 'Images: ',
    articleLikes: 'Likes: ',
    articleComments: 'Comments: ',
    chars: ' chars',
    件: '',

    // Background script messages
    blogListMoved: 'Moved to blog list page. Please press the export all articles button again.',
    exportDataNotFound: 'Export data not found',

    // Content script messages
    noArticlesToExport: 'No articles to export.',
    articleDataNotFound: 'Could not retrieve article data',
    markdownConversionFailed: 'Failed to convert to Markdown',
    exportProcessError: 'Error occurred during export: ',
    articleProcessError: 'Error occurred during article processing: ',

    // Warning messages
    doNotClosePopup: '⚠️ Export in progress. Please do not close this popup.',

    // Progress format strings
    progressPage: 'Page',
    progressArticleCount: 'Articles',
    progressImageCount: 'Images',
    progressArticles: 'Articles',
    progressImages: 'Images',
    collectingImageList: 'Collecting Images',
  },
};

// Helper function to get message by key
export function getMessage(lang: SupportedLanguage, key: keyof Messages): string {
  return messages[lang][key];
}

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ja';
