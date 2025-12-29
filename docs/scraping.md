# スクレイピング仕様

スクレイピングで使用するセレクタと判定ロジック。ロドストのHTML構造変更時に更新が必要。

## CSSセレクタ一覧

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

## ページネーション解析

```typescript
function getPaginationInfo(): number {
  let totalPages = 1;
  const paginationElement = document.querySelector('.btn__pager__current');
  if (paginationElement) {
    const paginationText = paginationElement.innerText;
    // JP版のみ対応: "1ページ / 8ページ"
    const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
    if (match?.[2]) {
      totalPages = parseInt(match[2], 10);
    }
  }
  return totalPages;
}
```

## 画像URL抽出

記事本文から画像URLを抽出:

```typescript
// 1. サムネイル画像（data-origin_src属性）
const thumbnailElements = document.querySelectorAll('.thumb_list img');
thumbnailElements.forEach(img => {
  const originalSrc = img.getAttribute('data-origin_src');
  if (originalSrc) imageUrls.push(originalSrc);
});

// 2. 記事本文内の画像
const imgElements = doc.querySelectorAll('img[data-origin_src]');
imgElements.forEach(img => {
  const originalSrc = img.getAttribute('data-origin_src');
  if (originalSrc) imageUrls.push(originalSrc);
});

// 3. 通常のimg要素
const regularImgElements = doc.querySelectorAll('img:not([data-origin_src])');

// 4. 画像ファイルへのリンク
const linkElements = doc.querySelectorAll('a[href]');
linkElements.forEach(link => {
  const href = link.href;
  if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(href)) {
    imageUrls.push(href);
  }
});
```
