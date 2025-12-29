# 多リージョン対応設計書

## 1. 対象リージョン

| リージョン | サブドメイン | 言語 |
|-----------|-------------|------|
| 日本 | jp.finalfantasyxiv.com | 日本語 |
| 北米 | na.finalfantasyxiv.com | 英語(US) |
| 欧州 | eu.finalfantasyxiv.com | 英語(UK) |
| フランス | fr.finalfantasyxiv.com | フランス語 |
| ドイツ | de.finalfantasyxiv.com | ドイツ語 |

## 2. 重要な発見

### 2.1 リージョン間の共通性

調査の結果、以下が判明:

- **全リージョンは同一バックエンドを共有**
- URLのサブドメインを変えてもログインセッションが維持される
- HTML構造（CSSクラス名、セレクタ）は完全に同一
- 表示言語のみが異なる

### 2.2 検証結果

**CSSセレクタ（curlで検証済み）:**
| リージョン | `entry__blog*` クラス | `btn__pager__current` |
|-----------|----------------------|----------------------|
| JP | ✅ 存在 | ✅ 存在 |
| NA | ✅ 存在 | ✅ 存在 |
| EU | ✅ 存在 | ✅ 存在 |
| FR | ✅ 存在 | ✅ 存在 |
| DE | ✅ 存在 | ✅ 存在 |

**ページネーション形式:**
| リージョン | 形式 |
|-----------|------|
| JP | `1ページ / 8ページ` |
| NA/EU | `Page 1 of 127` |
| FR | `Page 1 / 121` |
| DE | `Seite 1 (von 121)` |

## 3. 採用方針

### 3.1 スクレイピングはJP版を使用

**決定**: ユーザーがどのリージョンのページを閲覧していても、スクレイピング時は常にJP版URLにアクセスする。

**理由**:
- 全リージョンでセッションが共有されるため、JPへのアクセスが可能
- JP版の構造は検証済みで動作保証がある
- ページネーション正規表現やセレクタの多言語対応が不要
- コードの複雑化を回避

### 3.2 UI言語は自動判定

- `navigator.language`でブラウザの言語設定を取得
- 日本語 → ja、その他 → en
- 言語セレクタで手動切替も可能

## 4. 実装内容

### 4.1 manifest.json（✅ 完了）

5リージョン分のmatchesとhost_permissionsを追加。
これにより、どのリージョンのページでもContent Scriptが有効化される。

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

### 4.2 popup.ts（✅ 完了）

**URL判定を5リージョン対応:**
```typescript
const isLodestoneCharacterUrl = /^https:\/\/(jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/character\//.test(currentUrl);
```

**言語自動判定:**
```typescript
currentLanguage = navigator.language.startsWith("ja") ? "ja" : "en";
```

### 4.3 変更不要のファイル

| ファイル | 理由 |
|---------|------|
| constants.ts | JP版URL固定のまま維持 |
| content.ts | JP版をスクレイピングするため変更不要 |
| background.ts | 変更不要 |

## 5. テスト項目

- [ ] JP: ブログ一覧ページでエクスポートが動作する
- [ ] NA: ブログ一覧ページでエクスポートが動作する（JP版にリダイレクト）
- [ ] EU: ブログ一覧ページでエクスポートが動作する（JP版にリダイレクト）
- [ ] FR: ブログ一覧ページでエクスポートが動作する（JP版にリダイレクト）
- [ ] DE: ブログ一覧ページでエクスポートが動作する（JP版にリダイレクト）
- [ ] 言語自動判定が正しく動作する
- [ ] 言語セレクタで手動切替ができる

## 6. 注意事項

- 全リージョンでログインセッションが共有されることが前提
- 将来的にリージョン間のセッション分離が行われた場合は再検討が必要
