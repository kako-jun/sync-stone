# SyncStone 実装詳細設計書

## 概要

SyncStone Chrome拡張機能は、ロードストーン（FFXIV公式サイト）のブログ記事と画像をMarkdown形式でエクスポートするツールです。

**技術的特徴**:
- IndexedDBによる画像データの永続化（メモリ制限回避）
- zip.jsによるストリーミングZIP生成（大容量データ対応）
- 5リージョン対応（JP, NA, EU, FR, DE）

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UI Layer                                              │   │
│  │  ┌─────────────┐    ┌─────────────────────────────┐  │   │
│  │  │   Popup     │    │     Content Script          │  │   │
│  │  │ popup.html  │    │     content.ts              │  │   │
│  │  │ popup.ts    │    │  - スクレイピング           │  │   │
│  │  │             │    │  - Markdown変換             │  │   │
│  │  │             │    │  - ZIP生成                  │  │   │
│  │  └─────────────┘    └─────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Service Layer                                         │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │           Background Script (Service Worker)     │  │   │
│  │  │           background.ts                          │  │   │
│  │  │  - タブ管理                                      │  │   │
│  │  │  - 画像ダウンロード                              │  │   │
│  │  │  - IndexedDB保存                                 │  │   │
│  │  │  - メッセージルーティング                        │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Storage Layer                                         │   │
│  │  ┌─────────────────┐    ┌────────────────────────┐   │   │
│  │  │   IndexedDB     │    │    Temporary Tabs      │   │   │
│  │  │  SyncStoneDB    │    │  記事・画像取得用      │   │   │
│  │  │  永続化ストレージ │    │                        │   │   │
│  │  └─────────────────┘    └────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ZIP Generation Layer                                  │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │              zip.js                              │  │   │
│  │  │         Streaming ZIP Writer                     │  │   │
│  │  │         メモリ効率的なZIP生成                    │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │   Lodestone         │    │     Chrome Downloads API   │  │
│  │ *.finalfantasyxiv.com│    │                            │  │
│  └─────────────────────┘    └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント役割分担

### 1. Popup (popup.ts)

**責任範囲**: ユーザーインターフェース

- ユーザー操作の受付
- エクスポート設定の管理（アクセス間隔など）
- 進捗表示の更新（Phase別表示）
- エラーメッセージの表示
- **言語自動判定**（navigator.languageベース、ja/en）

### 2. Content Script (content.ts)

**責任範囲**: Webページのスクレイピングと統合ZIP生成

- ブログ記事一覧の抽出
- 記事詳細の抽出（記事内画像URL検出含む）
- 画像一覧ページのスクレイピング
- HTMLからMarkdownへの変換（Turndown使用）
- IndexedDBからの画像データ読み込み
- zip.jsによる統合ZIP生成（記事+画像）

### 3. Background Script (background.ts)

**責任範囲**: 中央制御とリソース管理

- タブの作成と管理
- 画像のダウンロード処理
- IndexedDBへの画像データ保存
- メッセージルーティング
- エクスポート状態管理

## ポップアップUI仕様

### UI構成要素

```
┌─────────────────────────────────────────────┐
│  SyncStone - 星紡のメモワール               │  タイトル
│  ロドストの記事を、Markdown形式で...        │  説明文
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ アクセス間隔: [2000] ms             │    │  設定コンテナ
│  │ 言語: [日本語 ▼] (非表示)           │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ ☄ すべての記事をエクスポート        │    │  全記事エクスポートボタン
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ☄ この記事をエクスポート            │    │  個別記事エクスポートボタン
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ 記事情報                            │    │  記事情報コンテナ
│  │ タイトル: xxxxx                     │    │  （個別記事ページのみ）
│  │ 本文: 1234文字 | 画像: 5件 | ...    │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ 🖼️ 画像エクスポート                 │    │  画像進捗バー
│  │ 画像: 45/100件                      │    │
│  │ [███████████░░░░░░░] 45.0%          │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ 📝 記事エクスポート                 │    │  記事進捗バー
│  │ 記事: 10/50件                       │    │
│  │ [████░░░░░░░░░░░░░░] 20.0%          │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ エクスポート完了！                   │    │  ステータスメッセージ
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ ⛔ エクスポートをキャンセル          │    │  キャンセルボタン
│  └─────────────────────────────────────┘    │  （エクスポート中のみ）
└─────────────────────────────────────────────┘
```

### 表示状態の条件分岐

| 現在のページ | 全記事ボタン | 個別ボタン | 記事情報 | 設定 | ガイダンス |
|-------------|------------|----------|---------|------|-----------|
| ロドスト以外 | 非表示 | 非表示 | 非表示 | 非表示 | 表示 |
| キャラページ（ブログ外） | 非表示 | 非表示 | 非表示 | 非表示 | 表示 |
| ブログ一覧（1ページ目） | 表示（通常テキスト） | 非表示 | 非表示 | 表示 | 非表示 |
| ブログ一覧（2ページ目〜） | 表示（移動テキスト） | 非表示 | 非表示 | 表示 | 非表示 |
| 個別記事ページ | 表示（移動テキスト） | 表示 | 表示 | 表示 | 非表示 |

**ボタンテキストの変化**:
- 1ページ目: `☄ すべての記事をエクスポート`
- それ以外: `1ページ目へ移動 → すべての記事をエクスポート`

### ガイダンスメッセージ

非対応ページでは以下のガイダンスを表示:

```
┌─────────────────────────────────────────────┐
│  ℹ️                                         │
│  ロドストのブログページに移動してください   │
│  • 記事一覧ページ → 全記事エクスポート      │
│  • 個別記事ページ → 個別 + 全記事エクスポート│
│                                             │
│         [ロドストにアクセス]                │
└─────────────────────────────────────────────┘
```

### 確認ダイアログ

全記事エクスポート時に表示:

```
┌─────────────────────────────────────────────┐
│  78件の記事が見つかりました。               │
│  エクスポートしますか？（自分の記事）       │
│                                             │
│  [はい]  [いいえ]                           │
└─────────────────────────────────────────────┘
```

- 自分のブログ: `（自分の記事）` → 画像一覧からの取得あり
- 他人のブログ: `（自分以外の記事）` → 記事内画像のみ

### 進捗表示の種類

| 進捗タイプ | プログレスバー | 表示内容 |
|-----------|--------------|---------|
| pages | なし（ステータスメッセージ） | `記事数を収集中 - ページ 1/8 - 記事数: 78件` |
| images | 画像プログレスバー | `画像: 45/100件 \| image_123.jpg` |
| articles | 記事プログレスバー | `記事: 10/50件 \| 記事タイトル...` |
| collecting | 記事プログレスバー | 記事詳細収集中 |

### アクセス間隔設定

```typescript
// 入力制限
最小値: 2000ms（2秒）
最大値: 10000ms（10秒）
デフォルト: 2000ms

// タイムアウト計算
timeout = max(5000, exportDelay × 3)
```

### i18n（国際化）

**言語自動判定**:
```typescript
currentLanguage = navigator.language.startsWith("ja") ? "ja" : "en";
```

**対応言語**: 日本語 (ja)、英語 (en)

**言語セレクタ**: HTMLには存在するが `display: none` で非表示。
将来の手動切替用に残されている。

### ステータスメッセージの種類

| タイプ | 背景色 | 文字色 | 用途 |
|-------|--------|--------|------|
| success | 緑（半透明） | 濃い緑 | 完了通知 |
| error | 赤（半透明） | 濃い赤 | エラー通知 |
| info | 緑（半透明） | 濃い緑 | 進行中の情報 |

### UIデザイン

**デザインテーマ**: ガラス調（Glassmorphism）
- 背景: 青のグラデーション + 星のような光点
- コンテナ: 半透明白 + `backdrop-filter: blur(10px)`
- ボタン: 白背景 + ホバーで影

---

### 4. IndexedDB (utils/indexedDB.ts)

**責任範囲**: 永続的画像データストレージ

```typescript
// データベース構成
const DB_NAME = 'SyncStoneDB';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

// 保存される画像データ構造
interface StoredImage {
  url: string;      // キー（一意識別子）
  base64: string;   // 画像データ（base64エンコード）
  filename: string; // ファイル名
  success: boolean; // ダウンロード成功フラグ
}
```

**提供する機能**:
- `openDB()`: データベース接続
- `saveImage()`: 単一画像の保存
- `saveImagesBatch()`: バッチ保存（効率化）
- `getImage()`: 画像の取得
- `getImageCount()`: 画像数の取得
- `clearAllImages()`: 全画像のクリア
- `deleteDatabase()`: データベース削除（エクスポート完了後）

## エクスポート処理フロー

### A. 個別記事エクスポート

```
User → Popup: "記事をエクスポート"クリック
Popup → Background: exportSingleArticle
Background → Content: extractArticleDetails
Content → Lodestone: 記事ページから情報取得
Content: HTMLをMarkdownに変換

[記事内画像のダウンロード]
Content → Background: downloadAllImages (記事内画像)
Background: 画像を順次ダウンロード
Background → IndexedDB: 画像を保存

[統合ZIP生成]
Content: ZipWriter作成
Content: 記事Markdownを追加
Content ← IndexedDB: 画像データ取得（ループ）
Content: 画像をストリーミング追加
Content: ZIP生成完了
Content → Downloads: 統合ZIPダウンロード
Content → IndexedDB: データベースクリーンアップ
Content → Popup: 完了通知
```

### B. 全記事エクスポート（自分のブログ）- 4フェーズ処理

**Phase 0: 画像一覧収集**
- 画像一覧ページ（/lodestone/my/image/）から全画像URLを収集
- Background Scriptが一時タブを作成してスクレイピング
- 全画像をIndexedDBにダウンロード・保存

**Phase 1: 記事処理**
- 各記事ページから詳細情報を抽出
- 記事内の新規画像URLを検出・蓄積

**Phase 2: 追加画像ダウンロード**
- Phase 1で検出された追加画像をダウンロード
- IndexedDBに保存

**Phase 3: 統合ZIP生成**
- zip.jsでZipWriter作成
- 全記事のMarkdownファイルを追加
- 記事インデックス（index.md）を追加
- IndexedDBから全画像を取得してストリーミング追加
- 統合ZIP生成・ダウンロード
- IndexedDB削除

### C. 全記事エクスポート（他人のブログ）

Phase 0をスキップ（画像一覧ページにアクセスできないため）。
記事内に含まれる画像のみをダウンロード・エクスポート。

## 技術的改善点

### 1. メモリ制限問題の解決

**旧実装（問題）**:
```javascript
// globalThis.downloadedImagesに全画像を保存
globalThis.downloadedImages = []; // Chrome Service Workerのメモリ制限に到達
```

**新実装（解決）**:
```javascript
// IndexedDBによる永続化
await saveImage({
  url: imageUrl,
  base64: base64Data,
  filename: filename,
  success: true
});
```

### 2. ZIP生成の改善

**旧実装（問題）**:
```javascript
// JSZip - メモリ内で全データ保持
const zip = new JSZip();
zip.file('article.md', content);
const content = await zip.generateAsync({type: 'base64'}); // RangeError発生
```

**新実装（解決）**:
```javascript
// zip.js - ストリーミング処理
const zipWriter = new zip.ZipWriter(new zip.BlobWriter());
await zipWriter.add('article.md', new zip.TextReader(content));
await zipWriter.add('image.jpg', new zip.Uint8ArrayReader(imageBytes));
const zipBlob = await zipWriter.close(); // メモリ効率的
```

### 3. 統合ZIP生成

**旧実装**: 記事ZIP と 画像ZIP を分離（2ファイル）
**新実装**: 記事と画像を1つの統合ZIPに（ユーザビリティ向上）

## メッセージパッシング

### Popup → Background
- `exportAllArticles`: 全記事エクスポート開始
- `confirmExportAll`: エクスポート確認
- `cancelExport`: エクスポートキャンセル
- `setExportDelay`: アクセス間隔設定

### Content → Background
- `fetchPageInNewTab`: 新規タブでページ取得
- `fetchArticleInNewTab`: 新規タブで記事取得
- `fetchImageListPage`: 画像一覧ページ取得
- `downloadAllImages`: 画像ダウンロード（IndexedDB保存）
- `getDownloadedImage`: IndexedDBから画像取得
- `setAllEntriesData`: 全記事データ設定

### Background → Content
- `exportAllArticlesFromContent`: Content Script側でエクスポート実行
- `processAllArticlesFromContent`: 記事処理実行
- `scrapeImageListPage`: 画像一覧スクレイピング
- `cancelExport`: エクスポートキャンセル

### Background → Popup
- `updateProgress`: 進捗更新（Phase別）
- `exportComplete`: エクスポート完了
- `exportCancelled`: エクスポートキャンセル

## ファイル構造

```
chrome-extension/src/
├── background/
│   └── background.ts      # Service Worker、中央制御、IndexedDB保存
├── content/
│   └── content.ts         # スクレイピング、zip.js統合ZIP生成
├── popup/
│   └── popup.ts           # UI制御、Phase別プログレス表示
├── popup.html             # ガラス調UI
├── utils/
│   ├── constants.ts       # 定数定義、セレクタ
│   ├── helpers.ts         # ユーティリティ関数
│   └── indexedDB.ts       # IndexedDB操作ユーティリティ
├── locales/
│   └── messages.ts        # i18n辞書（ja/en）
├── types/
│   └── index.ts           # TypeScript型定義
└── manifest.json          # 拡張機能マニフェスト（5リージョン対応）
```

## パフォーマンス特性

| 項目 | 旧実装 | 新実装 |
|------|--------|--------|
| メモリ使用量 | 377MB相当のbase64データ保持 → 制限到達 | IndexedDB永続化 → 制限なし |
| ZIP生成 | JSZip全データメモリ内処理 → RangeError | zip.jsストリーミング → 大容量対応 |
| 出力ファイル | 記事ZIP + 画像ZIP（2ファイル） | 統合ZIP（1ファイル） |
| 検証済み規模 | 〜80ファイル | 446枚の画像を含む大規模エクスポート |

## 5リージョン対応

### 対応リージョン

| リージョン | サブドメイン | 状態 |
|-----------|-------------|------|
| 日本 | jp.finalfantasyxiv.com | ✅ |
| 北米 | na.finalfantasyxiv.com | ✅ |
| 欧州 | eu.finalfantasyxiv.com | ✅ |
| フランス | fr.finalfantasyxiv.com | ✅ |
| ドイツ | de.finalfantasyxiv.com | ✅ |

### 実装方針

- **manifest.json**: 5リージョン全てでContent Scriptを有効化
- **スクレイピング**: 常にJP版URLを使用（全リージョンで同一構造のため）
- **UI言語**: navigator.languageで自動判定（ja/en）、手動切替可能

詳細は `docs/multi-region-support.md` を参照。

## i18nメッセージ一覧

### メッセージカテゴリ

| カテゴリ | 説明 |
|---------|------|
| Extension info | 拡張機能名と説明 |
| Settings | 設定ラベル |
| Buttons | ボタンテキスト |
| Confirmation | 確認ダイアログ |
| Progress | 進捗表示 |
| Success/Error | 結果通知 |
| Guidance | ガイダンス表示 |
| Article info | 記事情報表示 |

### 主要メッセージ

**拡張機能名**:
- ja: `SyncStone - 星紡のメモワール`
- en: `SyncStone - Stardustmemoir`

**ボタン**:
- 全記事エクスポート: `☄ すべての記事をエクスポート` / `Export All Articles`
- 個別記事エクスポート: `☄ この記事をエクスポート` / `Export Current Article`
- キャンセル: `⛔ エクスポートをキャンセル` / `⛔ Cancel Export`

**進捗ヘッダー**:
- 画像: `🖼️ 画像エクスポート` / `🖼️ Exporting Images`
- 記事: `📝 記事エクスポート` / `📝 Exporting Articles`

詳細は `src/locales/messages.ts` を参照。

## CSSセレクタ一覧

スクレイピングで使用するセレクタ。ロドストのHTML構造変更時に更新が必要。

### ブログ一覧ページ

| セレクタ | 用途 | 取得対象 |
|---------|------|---------|
| `li.entry__blog` | ブログエントリ | 記事リストの各項目 |
| `a.entry__blog__link` | 記事リンク | 記事URL |
| `h2.entry__blog__title` | 記事タイトル | タイトルテキスト |
| `time span` | 投稿日時 | 日時テキスト |
| `div.entry__blog__tag ul li` | タグ | 記事のタグ一覧 |
| `div.entry__blog__img__inner img` | サムネイル | サムネイル画像URL |
| `.btn__pager__current` | ページネーション | `1ページ / 8ページ` 形式 |

### 個別記事ページ

| セレクタ | 用途 | 取得対象 |
|---------|------|---------|
| `h2.entry__blog__title` | 記事タイトル | タイトルテキスト |
| `div.txt_selfintroduction` | 記事本文 | HTMLコンテンツ |
| `.blog__area__like__text__zero, .js__like_count` | いいね数 | 数値 |
| `.entry__blog__header__comment span` | コメント数 | 数値 |
| `.entry__blog__header time span, time[datetime]` | 公開日時 | datetime属性またはテキスト |
| `.entry__blog__tag ul li a` | タグ | タグ一覧 |
| `.thumb_list img` | サムネイル画像 | data-origin_src属性 |

### コメント

| セレクタ | 用途 | 取得対象 |
|---------|------|---------|
| `.thread__comment__body` | コメント本文 | HTMLコンテンツ |
| `.entry__name` | コメント者名 | 名前テキスト |
| `.entry__time--comment` | コメント日時 | 日時テキスト |

### 画像一覧ページ

| セレクタ | 用途 | 取得対象 |
|---------|------|---------|
| `.image__list a.outboundLink.outboundImage[data-target="external_image"]` | 外部画像 | GitHubなどの外部画像URL |
| `.image__list a.fancybox_element[rel="view_image"]` | 内部画像 | FFXIVスクリーンショットURL |

## 自分のブログ判定

### 判定ロジック

```typescript
function detectOwnBlog(): boolean {
  const bodyId = document.body.getAttribute('id');
  const hasIdAttribute = document.body.hasAttribute('id');

  // 他人のブログの場合、body要素に id="community" が付与される
  // 自分のブログの場合、id属性がない or "community"以外
  return !hasIdAttribute || bodyId !== 'community';
}
```

### 判定結果の影響

| 判定結果 | Phase 0（画像一覧） | エクスポート対象 |
|---------|-------------------|----------------|
| 自分のブログ | 実行（/my/image/にアクセス） | 画像一覧 + 記事内画像 |
| 他人のブログ | スキップ | 記事内画像のみ |

### 確認ダイアログ表示

- 自分のブログ: `（自分の記事）`
- 他人のブログ: `（自分以外の記事）`

## Turndown設定

HTMLからMarkdownへの変換設定。

### 画像変換ルール

```typescript
turndownService.addRule('image', {
  filter: 'img',
  replacement: function (_content: string, node: any) {
    const originalSrc = node.getAttribute('src');
    const alt = node.getAttribute('alt') || '';
    // imageMapでローカルパスに変換
    const newSrc = imageMap[originalSrc] || originalSrc;
    return `![${alt}](${newSrc})`;
  }
});
```

### 画像リンク変換ルール

```typescript
turndownService.addRule('imageLink', {
  filter: function (node: any) {
    // 画像ファイルへのリンクを検出
    return node.nodeName === 'A' &&
           node.getAttribute('href') &&
           /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(node.getAttribute('href'));
  },
  replacement: function (content: string, node: any) {
    const originalHref = node.getAttribute('href');
    const newHref = imageMap[originalHref] || originalHref;
    return `[${content}](${newHref})`;
  }
});
```

### 出力フォーマット

```markdown
---
title: "記事タイトル"
date: "2025-01-15"
likes: 42
comments: 5
tags:
  - タグ1
  - タグ2
---

![](images/xxx_image.jpg)

記事本文...

## Comments

### コメント者名 (2025-01-15 12:34)

コメント本文...

---
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

### 定数パターン

```typescript
export const FILE_PATTERNS = {
  THUMBNAIL_PATTERN: /_\d{2,3}_\d{2,3}(?:\.|$)/,  // サムネイル判定
  INVALID_FILENAME_CHARS: /[\\/:*?"<>|]/g,        // 無効文字
  WHITESPACE: /\s+/g                               // 空白文字
} as const;
```

### waitForTabLoad

タブの読み込み完了を待機。

```typescript
function waitForTabLoad(tabId: number, timeout = 10000): Promise<void> {
  return new Promise((resolve) => {
    const listener = (changedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // タイムアウト時はフォールバック
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);
  });
}
```

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
  title: string;
  bodyHtml: string;
  likes: number;
  commentsCount: number;
  publishDate: string | null;
  tags: string[];
  imageUrls: string[];
  thumbnailUrls: string[];
  commentsData: CommentData[];
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
