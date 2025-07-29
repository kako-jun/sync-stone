# SyncStone Chrome拡張機能 設計書

## 概要

SyncStone Chrome拡張機能は、ロードストーン（FFXIV公式サイト）のブログ記事と画像をMarkdown形式でエクスポートするツールです。

## アーキテクチャ概要

```mermaid
graph TB
    subgraph "Chrome Extension"
        subgraph "UI Layer"
            P[Popup<br/>popup.html/popup.ts]
            C[Content Script<br/>content.ts]
        end
        
        subgraph "Service Layer"
            B[Background Script<br/>background.ts<br/>Service Worker]
        end
        
        subgraph "Storage Layer"
            G[Global Memory<br/>globalThis.downloadedImages]
            T[Temporary Tabs<br/>記事・画像取得用]
        end
    end
    
    subgraph "External Services"
        L[Lodestone Website<br/>jp.finalfantasyxiv.com]
        D[Downloads API<br/>Chrome Extension API]
    end
    
    P -->|User Action| B
    B -->|Create Tab| T
    T -->|Scrape Content| C
    C -->|Return Data| B
    B -->|Store Images| G
    B -->|Download ZIP| D
    T -->|Fetch Data| L
```

## コンポーネント役割分担

### 1. Popup (popup.ts)
**責任範囲**: ユーザーインターフェース
- ユーザー操作の受付
- エクスポート設定の管理
- 進捗表示の更新
- エラーメッセージの表示

### 2. Content Script (content.ts)
**責任範囲**: Webページのスクレイピング
- ブログ記事一覧の抽出
- 記事詳細の抽出
- 画像一覧ページのスクレイピング
- HTMLからMarkdownへの変換
- ZIPファイルの生成

### 3. Background Script (background.ts)
**責任範囲**: 中央制御とリソース管理
- タブの作成と管理
- 画像のダウンロード処理
- グローバル状態の管理
- メッセージルーティング
- ファイルダウンロードの実行

## エクスポート処理フロー

### A. 個別記事エクスポート

```mermaid
sequenceDiagram
    participant U as User
    participant P as Popup
    participant B as Background
    participant C as Content Script
    participant L as Lodestone
    participant D as Downloads

    U->>P: "記事をエクスポート"クリック
    P->>B: exportSingleArticle
    B->>C: extractArticleDetails
    C->>L: 記事ページから情報取得
    C->>C: HTMLをMarkdownに変換
    C->>C: 記事内画像のダウンロード
    Note over C: downloadAllImages -> Background
    B->>B: 画像をglobalThis.downloadedImagesに保存
    C->>C: ZIPファイル生成
    C->>D: 記事ZIPダウンロード
    C->>P: 完了通知
```

### B. 全記事エクスポート（自分のブログ）

```mermaid
sequenceDiagram
    participant U as User
    participant P as Popup
    participant B as Background
    participant C as Content Script
    participant T as Temp Tab
    participant L as Lodestone
    participant D as Downloads

    U->>P: "全記事エクスポート"クリック
    P->>B: exportAllArticles
    B->>C: exportAllArticlesFromContent
    
    Note over C,L: Phase 0: 画像一覧ページから全画像収集
    loop 画像一覧の各ページ
        C->>B: fetchImageListPage
        B->>T: 新しいタブ作成
        T->>L: 画像一覧ページ取得
        T->>C: scrapeImageListPage
        C->>T: 画像URL一覧返却
        T->>B: 画像URL返却
        B->>T: タブ削除
    end
    
    C->>B: downloadAllImages (全画像URL)
    B->>B: 全画像をダウンロードしglobalThisに保存
    
    Note over C,L: Phase 1: 記事一覧ページから記事URL収集
    loop ブログ一覧の各ページ
        C->>B: fetchPageInNewTab
        B->>T: 新しいタブ作成
        T->>L: ブログ一覧ページ取得
        T->>C: ページスクレイピング
        C->>T: 記事URL一覧返却
        T->>B: 記事URL返却
        B->>T: タブ削除
    end
    
    Note over C,L: Phase 2: 各記事の詳細取得
    loop 各記事URL
        C->>B: fetchArticleInNewTab
        B->>T: 新しいタブ作成
        T->>L: 記事ページ取得
        T->>C: 記事詳細抽出
        C->>T: 記事データ返却
        T->>B: 記事データ返却
        B->>T: タブ削除
    end
    
    Note over C: Phase 3: ZIP生成とダウンロード
    C->>C: 記事ZIPファイル生成
    C->>D: 記事ZIPダウンロード
    C->>C: 画像ZIPファイル生成（globalThisから取得）
    C->>D: 画像ZIPダウンロード
    C->>P: 完了通知
```

### C. 全記事エクスポート（他人のブログ）

```mermaid
sequenceDiagram
    participant U as User
    participant P as Popup
    participant B as Background
    participant C as Content Script
    participant T as Temp Tab
    participant L as Lodestone
    participant D as Downloads

    U->>P: "全記事エクスポート"クリック
    P->>B: exportAllArticles
    B->>C: exportAllArticlesFromContent
    
    Note over C: Phase 0: 画像一覧収集をスキップ
    Note right of C: 他人のブログのため<br/>画像一覧ページにアクセスできない
    
    Note over C,L: Phase 1: 記事一覧ページから記事URL収集
    loop ブログ一覧の各ページ
        C->>B: fetchPageInNewTab
        B->>T: 新しいタブ作成
        T->>L: ブログ一覧ページ取得
        T->>C: ページスクレイピング
        C->>T: 記事URL一覧返却
        T->>B: 記事URL返却
        B->>T: タブ削除
    end
    
    Note over C,L: Phase 2: 各記事の詳細取得と記事内画像収集
    loop 各記事URL
        C->>B: fetchArticleInNewTab
        B->>T: 新しいタブ作成
        T->>L: 記事ページ取得
        T->>C: 記事詳細抽出 + 記事内画像URL抽出
        C->>T: 記事データ + 画像URL返却
        T->>B: データ返却
        B->>T: タブ削除
    end
    
    C->>B: downloadAllImages (記事内画像URL)
    B->>B: 記事内画像をダウンロードしglobalThisに保存
    
    Note over C: Phase 3: ZIP生成とダウンロード
    C->>C: 記事ZIPファイル生成
    C->>D: 記事ZIPダウンロード
    C->>C: 画像ZIPファイル生成（少量の記事内画像のみ）
    C->>D: 画像ZIPダウンロード
    C->>P: 完了通知
```

## データフロー詳細

### 画像処理フロー

```mermaid
flowchart TD
    A[画像URL収集開始] --> B{エクスポートタイプ}
    
    B -->|自分のブログ| C[画像一覧ページから<br/>全画像URL収集]
    B -->|他人のブログ| D[記事内画像URL<br/>のみ収集]
    
    C --> E[collectAndDownloadAllImagesInContent]
    D --> F[記事処理時に<br/>画像URL抽出]
    
    E --> G[Background Script:<br/>handleDownloadAllImages]
    F --> G
    
    G --> H[順次画像ダウンロード<br/>fetch + blob + base64変換]
    H --> I[globalThis.downloadedImages<br/>に保存]
    
    I --> J[Content Script:<br/>getDownloadedImage で取得]
    J --> K[ZIPファイルに追加]
    K --> L[画像ZIPダウンロード]
    
    style I fill:#ffcccc
    style I stroke:#ff0000
    note1[メモリ制限問題<br/>発生箇所]
    I -.-> note1
```

### 記事処理フロー

```mermaid
flowchart TD
    A[記事URL収集開始] --> B[ブログ一覧ページを<br/>順次取得]
    B --> C[各ページから記事URL抽出]
    C --> D[全記事URLリスト作成]
    
    D --> E[各記事詳細取得開始]
    E --> F[記事ページを順次取得]
    F --> G[記事詳細抽出<br/>- タイトル<br/>- 本文<br/>- メタデータ<br/>- コメント]
    
    G --> H[HTMLからMarkdown変換<br/>Turndownライブラリ使用]
    H --> I[画像URLの置換<br/>ローカルパスに変更]
    I --> J[記事ZIPファイル生成]
    J --> K[記事ZIPダウンロード]
```

## メッセージパッシング

### メッセージタイプ一覧

```mermaid
graph TD
    subgraph "Popup → Background"
        A1[exportAllArticles]
        A2[confirmExportAll]
        A3[cancelExport]
        A4[setExportDelay]
    end
    
    subgraph "Content → Background"
        B1[fetchPageInNewTab]
        B2[fetchArticleInNewTab]
        B3[fetchImageListPage]
        B4[downloadAllImages]
        B5[getDownloadedImage]
        B6[setAllEntriesData]
    end
    
    subgraph "Background → Content"
        C1[exportAllArticlesFromContent]
        C2[processAllArticlesFromContent]
        C3[scrapeImageListPage]
        C4[cancelExport]
    end
    
    subgraph "Background → Popup"
        D1[updateProgress]
        D2[exportComplete]
        D3[exportCancelled]
    end
```

## 現在の問題点と対策

### 問題: 画像ZIPに含まれる画像が不完全

**症状**: 
- 約80ファイル程度の軽いJPEG画像のみがZIPに含まれる
- アルファベット順や軽いサイズなど、何らかの基準で選別されている
- エラーは表示されない

**原因分析**:
1. **Service Workerメモリ制限**: `globalThis.downloadedImages`に大量のbase64画像を保存する際、Chrome Service Workerのメモリ制限に達している可能性
2. **非同期処理のタイミング問題**: 画像ダウンロード完了前にZIP生成が開始される可能性
3. **フェッチ処理の失敗**: 一部の画像のダウンロードが失敗しているが、エラーハンドリングで隠蔽されている可能性

**対策案**:
1. **IndexedDB使用**: globalThisの代わりにIndexedDBを使用してbase64画像を保存
2. **バッチ処理**: 画像を小さなバッチに分けてダウンロード・保存
3. **エラーログ強化**: 画像ダウンロード失敗の詳細ログを追加

## ファイル構造

```
src/
├── background/
│   └── background.ts          # Service Worker、中央制御
├── content/
│   └── content.ts            # スクレイピング、ZIP生成
├── popup/
│   ├── popup.html           # UI
│   └── popup.ts             # UI制御
├── utils/
│   ├── constants.ts         # 定数定義
│   └── helpers.ts           # ユーティリティ関数
└── types/
    └── index.ts             # TypeScript型定義
```

## 設定とカスタマイズ

```mermaid
graph LR
    A[ユーザー設定] --> B[エクスポート間隔<br/>最低2秒]
    A --> C[言語設定<br/>日本語/英語]
    A --> D[エクスポート形式<br/>Markdown + 画像]
    
    B --> E[Background Script]
    C --> E
    D --> E
    
    E --> F[Content Script]
    E --> G[タイムアウト計算<br/>間隔×3]
```

---

この設計書により、SyncStone Chrome拡張機能の全体像と、画像エクスポート問題の発生箇所が明確になりました。特に`globalThis.downloadedImages`でのメモリ制限が最も可能性の高い原因として特定されています。