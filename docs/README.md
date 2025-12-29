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
│   └── background.ts      # Service Worker
├── content/
│   └── content.ts         # Content Script
├── popup/
│   └── popup.ts           # ポップアップロジック
├── popup.html             # ポップアップUI
├── utils/
│   ├── constants.ts       # 定数
│   ├── helpers.ts         # ユーティリティ
│   └── indexedDB.ts       # IndexedDB操作
├── locales/
│   └── messages.ts        # i18n辞書
├── types/
│   └── index.ts           # 型定義
└── manifest.json          # 拡張機能マニフェスト
```
