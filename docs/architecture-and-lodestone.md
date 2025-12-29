# SyncStone アーキテクチャとロドスト連携仕様書

## 1. ロドスト（Lodestone）の構造

### 1.1 リージョン構成

ロドストは地域別に5つのサブドメインで運営されている:

| サブドメイン | 対象地域 | UI言語 |
|-------------|---------|--------|
| jp.finalfantasyxiv.com | 日本 | 日本語 |
| na.finalfantasyxiv.com | 北米 | 英語(US) |
| eu.finalfantasyxiv.com | 欧州 | 英語(UK) |
| fr.finalfantasyxiv.com | フランス | フランス語 |
| de.finalfantasyxiv.com | ドイツ | ドイツ語 |

### 1.2 主要ページ構成

```
/lodestone/
├── character/{characterId}/
│   ├── blog/                    # ブログ一覧ページ（公開）
│   │   ├── ?page=1              # ページネーション
│   │   └── {entryId}/           # 個別記事ページ（公開）
│   └── ...
└── my/
    └── image/                   # 画像一覧ページ（要ログイン）
        └── ?page=1              # ページネーション
```

### 1.3 ページネーション表示形式

| リージョン | 表示形式 | 例 |
|-----------|---------|-----|
| JP | `Xページ / Yページ` | `1ページ / 8ページ` |
| NA/EU | `Page X of Y` | `Page 1 of 127` |
| FR | `Page X / Y` | `Page 1 / 121` |
| DE | `Seite X (von Y)` | `Seite 1 (von 121)` |

### 1.4 認証要件

| ページタイプ | ログイン要否 |
|-------------|-------------|
| ブログ一覧 (`/character/{id}/blog/`) | 不要（公開） |
| 個別記事 (`/character/{id}/blog/{entryId}/`) | 不要（公開） |
| 画像一覧 (`/my/image/`) | **必要** |

---

## 2. SyncStone 現在のアーキテクチャ

### 2.1 ファイル構成

```
chrome-extension/src/
├── background/
│   └── background.ts       # Service Worker (メイン処理制御)
├── content/
│   └── content.ts          # Content Script (DOM操作、スクレイピング)
├── popup/
│   ├── popup.html          # ポップアップUI
│   └── popup.ts            # ポップアップロジック
├── locales/
│   └── messages.ts         # i18n辞書 (ja/en)
├── utils/
│   ├── constants.ts        # 定数・URL生成関数
│   └── indexedDB.ts        # 画像データ保存
└── types/
    └── index.ts            # 型定義
```

### 2.2 処理フロー

```
[ユーザー] → [popup.ts] → [background.ts] → [content.ts]
                                ↓
                          [IndexedDB]
                                ↓
                          [ZIPダウンロード]
```

1. **popup.ts**: UIイベント受付、background.tsへメッセージ送信
2. **background.ts**: 処理統括、タブ操作、画像ダウンロード
3. **content.ts**: DOM解析、記事/画像URL抽出、Markdown変換

### 2.3 主要機能

| 機能 | 実装状態 | 説明 |
|------|---------|------|
| 単一記事エクスポート | 実装済 | 現在表示中の記事をZIP化 |
| 全記事エクスポート | 実装済 | ブログ全記事を一括ZIP化 |
| 画像一覧取得 | 実装済 | `/my/image/`から全画像URL収集 |
| 画像ダウンロード | 実装済 | IndexedDBに保存、ZIP同梱 |
| Markdown変換 | 実装済 | Turndownライブラリ使用 |

---

## 3. 現在の対応状況

### 3.1 対応リージョン

| リージョン | manifest.json | constants.ts | content.ts | popup.ts | 状態 |
|-----------|--------------|--------------|------------|----------|------|
| JP | ✅ | ✅ | ✅ | ✅ | **動作** |
| NA | ❌ | ❌ | ❌ | ❌ | 未対応 |
| EU | ❌ | ❌ | ❌ | ❌ | 未対応 |
| FR | ❌ | ❌ | ❌ | ❌ | 未対応 |
| DE | ❌ | ❌ | ❌ | ❌ | 未対応 |

### 3.2 問題箇所の詳細

#### manifest.json
```json
// 現在: JPのみ
"matches": [
  "https://jp.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://jp.finalfantasyxiv.com/lodestone/my/image/*"
]
```
→ 他リージョンではContent Scriptが読み込まれない

#### constants.ts (行1-5)
```typescript
// 現在: JP固定
export const URLS = {
  LODESTONE_BASE: 'https://jp.finalfantasyxiv.com',
  IMAGE_LIST_PAGE: (page: number) => `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${page}`,
  BLOG_LIST_PAGE: (characterId: string) => `https://jp.finalfantasyxiv.com/lodestone/character/${characterId}/blog/`
}
```
→ URLが全てJP固定

#### content.ts (行148, 1219)
```typescript
// 現在: 日本語のみ
const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
```
→ 他言語のページネーションをパースできない

#### content.ts (行560)
```typescript
// 現在: JP固定
const imageUrlListPage = `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${currentPage}`;
```
→ constants.tsを使用していない（二重管理）

#### popup.ts (行455)
```typescript
// 現在: JP固定
const isLodestoneCharacterUrl = currentUrl.startsWith("https://jp.finalfantasyxiv.com/lodestone/character/");
```
→ 他リージョンでは「非対応ページ」と判定される

#### popup.html (行73)
```html
<!-- 現在: 非表示 -->
<div style="margin-bottom: 10px; display: none;">
  <!-- 言語セレクタ -->
</div>
```
→ 言語切り替えUIが使えない

---

## 4. 対応方針

### 4.1 基本方針（決定済み）

**重要な発見**: 全リージョン（JP, NA, EU, FR, DE）は同一のバックエンドを共有しており、URLのサブドメインを変えてもログインセッションが維持される。つまりHTML構造は完全に同一で、表示言語のみが異なる。

**採用方針**: スクレイピングは常にJP版URLを使用
- ユーザーがどのリージョンのページを見ていても、スクレイピング時はJP版にアクセス
- これにより、ページネーション正規表現やセレクタの多言語対応が不要
- 検証済みのJP構造をそのまま利用できる

### 4.2 変更計画

| ファイル | 変更内容 | 状態 |
|---------|---------|------|
| manifest.json | 5リージョン分のmatchesを追加（拡張機能の有効化用） | ✅ 完了 |
| constants.ts | 変更不要（JP固定のまま） | ✅ 維持 |
| content.ts | 変更不要（JP版をスクレイピング） | ✅ 維持 |
| popup.ts | URL判定を5リージョン対応 + 言語自動判定 | 作業中 |
| popup.html | 言語セレクタは維持（手動切替用） | 予定 |

### 4.3 UI言語の自動判定

- ブラウザの言語設定（`navigator.language`）で自動判定
- 日本語 → ja、その他 → en
- 言語セレクタで手動切替も可能（日本人が英語を選ぶことも可能）

### 4.4 後方互換性

- 既存のJPユーザーへの影響なし
- 設定の変更不要

---

## 5. 今後の確認事項

- [ ] 各リージョンでHTML構造（CSSセレクタ）が同一か確認
- [ ] 画像一覧ページのHTML構造が同一か確認
- [ ] 認証クッキーがリージョン間で共有されるか確認
