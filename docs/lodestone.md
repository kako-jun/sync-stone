# ロードストーン構造

ロードストーン（Lodestone）はFFXIV公式サイトのコミュニティ機能。

## リージョン構成

| サブドメイン | 対象地域 | UI言語 |
|-------------|---------|--------|
| jp.finalfantasyxiv.com | 日本 | 日本語 |
| na.finalfantasyxiv.com | 北米 | 英語(US) |
| eu.finalfantasyxiv.com | 欧州 | 英語(UK) |
| fr.finalfantasyxiv.com | フランス | フランス語 |
| de.finalfantasyxiv.com | ドイツ | ドイツ語 |

### 重要な発見

**全リージョンは同一バックエンドを共有**:
- URLのサブドメインを変えてもログインセッションが維持される
- HTML構造（CSSクラス名、セレクタ）は完全に同一
- 表示言語のみが異なる

**採用方針**: スクレイピングは常にJP版URLを使用
- ページネーション正規表現の多言語対応が不要
- 検証済みのJP構造をそのまま利用

## URL体系

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

## 認証要件

| ページタイプ | ログイン要否 |
|-------------|-------------|
| ブログ一覧 (`/character/{id}/blog/`) | 不要（公開） |
| 個別記事 (`/character/{id}/blog/{entryId}/`) | 不要（公開） |
| 画像一覧 (`/my/image/`) | **必要** |

## ページネーション形式

| リージョン | 表示形式 | 例 |
|-----------|---------|-----|
| JP | `Xページ / Yページ` | `1ページ / 8ページ` |
| NA/EU | `Page X of Y` | `Page 1 of 127` |
| FR | `Page X / Y` | `Page 1 / 121` |
| DE | `Seite X (von Y)` | `Seite 1 (von 121)` |

※ JP版URLを使用するため、JP形式のみ対応

## 5リージョン対応

### manifest.json

5リージョン全てでContent Scriptを有効化:

```json
"matches": [
  "https://jp.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://jp.finalfantasyxiv.com/lodestone/my/image/*",
  "https://na.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://na.finalfantasyxiv.com/lodestone/my/image/*",
  "https://eu.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://eu.finalfantasyxiv.com/lodestone/my/image/*",
  "https://fr.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://fr.finalfantasyxiv.com/lodestone/my/image/*",
  "https://de.finalfantasyxiv.com/lodestone/character/*/blog/*",
  "https://de.finalfantasyxiv.com/lodestone/my/image/*"
]
```

### popup.ts

URL判定を5リージョン対応:

```typescript
const isLodestoneCharacterUrl = /^https:\/\/(jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/character\//.test(currentUrl);
```

### constants.ts

JP固定のまま維持（スクレイピング時はJP版を使用）:

```typescript
export const URLS = {
  LODESTONE_BASE: 'https://jp.finalfantasyxiv.com',
  IMAGE_LIST_PAGE: (page: number) => `https://jp.finalfantasyxiv.com/lodestone/my/image/?page=${page}`,
  BLOG_LIST_PAGE: (characterId: string) => `https://jp.finalfantasyxiv.com/lodestone/character/${characterId}/blog/`
} as const;
```

## UI言語

- `navigator.language`でブラウザの言語設定を取得
- 日本語 → ja、その他 → en
- 言語セレクタで手動切替も可能
