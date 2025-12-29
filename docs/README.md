# SyncStone ドキュメント

SyncStone Chrome拡張機能の技術ドキュメント。

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [architecture.md](architecture.md) | システムアーキテクチャ、コンポーネント構成、処理フロー |
| [lodestone.md](lodestone.md) | ロドストの構造、URL体系、認証要件 |
| [scraping.md](scraping.md) | CSSセレクタ、自分のブログ判定、Turndown設定 |
| [popup-ui.md](popup-ui.md) | ポップアップUI仕様、表示条件、進捗表示 |
| [api-reference.md](api-reference.md) | 型定義、ヘルパー関数、メッセージパッシング |
| [use-cases.md](use-cases.md) | ユースケース、ページ種別・所有者による動作の違い |

## 概要

SyncStoneは、FFXIV公式サイト「ロードストーン」のブログ記事と画像をMarkdown形式でエクスポートするChrome拡張機能。

**技術的特徴**:
- IndexedDBによる画像データの永続化（メモリ制限回避）
- zip.jsによるストリーミングZIP生成（大容量データ対応）
- 5リージョン対応（JP, NA, EU, FR, DE）
- 日本語/英語の自動言語判定

## ファイル構成

```
chrome-extension/src/
├── background/
│   └── background.ts      # Service Worker（タブ管理、画像DL、メッセージング）
├── content/
│   ├── content.ts         # Content Scriptエントリポイント・ZIP生成
│   ├── scraper.ts         # ロドストページのスクレイピング
│   ├── exporter.ts        # ZIPダウンロードヘルパー
│   ├── markdown.ts        # HTML→Markdown変換（Turndown）
│   └── notification.ts    # ページ内通知UI
├── popup/
│   └── popup.ts           # ポップアップUI・設定管理
├── utils/
│   ├── constants.ts       # 定数・設定値
│   ├── helpers.ts         # ユーティリティ関数
│   └── indexedDB.ts       # IndexedDB操作
├── locales/
│   └── messages.ts        # 多言語メッセージ定義
├── types/
│   ├── index.ts           # アプリケーション型定義（メッセージ型含む）
│   ├── zip.d.ts           # zip.js型宣言
│   └── turndown.d.ts      # Turndown型宣言
└── manifest.json          # 拡張機能マニフェスト（Manifest V3）
```
