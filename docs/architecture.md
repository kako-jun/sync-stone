# アーキテクチャ

## システム構成

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
│  │  └─────────────────┘    └────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ZIP Generation Layer                                  │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │              zip.js                              │  │   │
│  │  │         Streaming ZIP Writer                     │  │   │
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

## コンポーネント責任

### Popup (popup.ts)

- ユーザー操作の受付
- エクスポート設定の管理（アクセス間隔）
- 進捗表示の更新（Phase別）
- エラーメッセージの表示
- 言語自動判定（navigator.language）

### Content Script (content.ts, scraper.ts, markdown.ts, exporter.ts, notification.ts)

**content.ts（エントリポイント）**:
- メッセージハンドラの登録
- エクスポート処理の制御
- IndexedDBからの画像データ読み込み
- zip.jsによる統合ZIP生成

**scraper.ts**:
- ブログ記事一覧の抽出
- 記事詳細の抽出（記事内画像URL含む）
- 画像一覧ページのスクレイピング

**markdown.ts**:
- HTMLからMarkdownへの変換（Turndown）
- YAMLフロントマター生成
- 画像URLの書き換え

**exporter.ts**:
- ZIPダウンロードヘルパー

**notification.ts**:
- ページ内通知UIの表示・管理

### Background Script (background.ts)

- タブの作成と管理
- 画像のダウンロード処理
- IndexedDBへの画像データ保存
- メッセージルーティング
- エクスポート状態管理

### IndexedDB (indexedDB.ts)

- 画像データの永続化
- base64エンコードされた画像の保存・取得
- エクスポート完了後の自動クリーンアップ

## エクスポート処理フロー

### 個別記事エクスポート

```
User → Popup: "記事をエクスポート"クリック
Popup → Content: exportSingleArticle
Content: 記事ページから情報取得
Content: HTMLをMarkdownに変換
Content → Background: downloadAllImages
Background → IndexedDB: 画像を保存
Content: ZipWriter作成、ZIP生成
Content → Downloads: ZIPダウンロード
Content → IndexedDB: クリーンアップ
```

### 全記事エクスポート（4フェーズ）

**Phase 0: 画像一覧収集**（自分のブログのみ）
- `/lodestone/my/image/` から全画像URLを収集
- Background Scriptが一時タブを作成
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

## 技術的改善点

### メモリ制限問題の解決

**旧実装（問題）**:
```javascript
globalThis.downloadedImages = []; // メモリ制限に到達
```

**新実装（解決）**:
```javascript
await saveImage({ url, base64, filename, success: true }); // IndexedDB
```

### ZIP生成の改善

**旧実装（問題）**:
```javascript
const zip = new JSZip();
await zip.generateAsync({type: 'base64'}); // RangeError
```

**新実装（解決）**:
```javascript
const zipWriter = new zip.ZipWriter(new zip.BlobWriter());
await zipWriter.add('file.md', new zip.TextReader(content));
const zipBlob = await zipWriter.close(); // ストリーミング
```

## パフォーマンス特性

| 項目 | 旧実装 | 新実装 |
|------|--------|--------|
| メモリ使用量 | 377MB → 制限到達 | IndexedDB → 制限なし |
| ZIP生成 | JSZip → RangeError | zip.js → 大容量対応 |
| 出力ファイル | 2ファイル | 統合ZIP 1ファイル |
| 検証済み規模 | ~80ファイル | 446枚画像 |
