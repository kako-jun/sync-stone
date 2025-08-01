# SyncStone - 星紡のメモワール Chrome 拡張機能

SyncStone - 星紡（せいぼう）のメモワールは、FINAL FANTASY XIV 関連の非公式ツールです。本拡張機能は、ロドスト（The Lodestone）に投稿された日記を Markdown 形式でローカルにエクスポートするための Chrome 拡張機能です。ロドストの日記にはエクスポート機能がないため、大切な思い出を失わないようにバックアップすることを目的としています。

<p align="center">
  <img src="28445b1c091759ab82531cc3a64b5ca7ced45c89.jpg" alt="kako-jun">
</p>

## 機能概要

- **単一記事のエクスポート**: 現在開いているロドストの日記個別記事ページ、または日記編集ページから、記事のタイトル、本文、すべての画像（内部・外部問わず）、コメント、いいね数、公開日時、タグを取得し、Markdown ファイルと画像をまとめた ZIP ファイルとしてダウンロードします。
- **全記事のエクスポート**: ロドストの日記一覧ページから、すべての記事のタイトル、本文、すべての画像（内部・外部問わず）、コメント、いいね数、公開日時、タグを取得し、Markdown 形式に変換して記事と画像を統合したZIPファイルとしてダウンロードします。この際、すべての画像がダウンロードされ、ZIP ファイル内に`images/`フォルダとして含まれます。
- **コメントの取得**: 記事に付随するコメントの本文も取得し、Markdown ファイル内に含めます。
- **画像の一括ダウンロード**: 全記事エクスポート時、ロドストの画像管理ページからすべての画像を事前にダウンロードし、ZIP ファイルに含めます。これにより、記事内で参照されている画像が重複してダウンロードされることを防ぎ、ローカルでの閲覧時に画像が正しく表示されるようにします。
- **記事一覧の生成**: 全記事エクスポート時、エクスポートされたすべての記事へのリンクを含む`index.md`ファイルを ZIP ファイル内に生成します。このファイルは、[Visual Studio Code](https://code.visualstudio.com/) などの Markdown プレビュー機能を備えたテキストエディタで開くと、エクスポートされた記事へのリンク集として便利に利用できます。

## インストール方法

### 方法 1: Releases からダウンロード（推奨）

1.  [GitHub Releases](https://github.com/kako-jun/sync-stone/releases)から最新の`sync-stone-chrome-extension.zip`をダウンロードします。
2.  ZIP ファイルを任意のフォルダに解凍します。
3.  Chrome ブラウザを開き、アドレスバーに `chrome://extensions` と入力して拡張機能管理ページを開きます。
4.  右上の「デベロッパーモード」をオンにします。
5.  「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします。
6.  解凍したフォルダを選択します。
7.  SyncStone 拡張機能が Chrome に追加されます。

### 方法 2: ソースからビルド

1.  このリポジリをクローンまたは[ダウンロード](https://github.com/kako-jun/sync-stone/archive/refs/heads/main.zip)します。
2.  `chrome-extension`フォルダに移動し、以下のコマンドを実行します：
    ```bash
    npm install
    npm run build
    ```
3.  Chrome ブラウザを開き、アドレスバーに `chrome://extensions` と入力して拡張機能管理ページを開きます。
4.  右上の「デベロッパーモード」をオンにします。
5.  「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします。
6.  `chrome-extension/dist`フォルダを選択します。
7.  SyncStone 拡張機能が Chrome に追加されます。

## 使用方法

### 1. アクセス間隔の設定

拡張機能のポップアップを開くと、「アクセス間隔」という入力欄があります。これは、ロドストのサーバーに連続してアクセスする際の待機時間（ミリ秒単位）で、ページ読み込みタイムアウトや処理の遅延にも影響します。サーバーへの負荷を考慮し、デフォルトは 2000 ミリ秒（2 秒）に設定されており、2000 ミリ秒未満には設定できません。必要に応じて調整してください。

### 2. 単一記事のエクスポート

1.  エクスポートしたいロドストの日記個別記事ページ（例: `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/ARTICLE_ID/`）を開きます。
2.  Chrome のツールバーにある SyncStone のアイコンをクリックしてポップアップを開きます。
3.  「この記事をエクスポート」ボタンをクリックします。
4.  Markdown ファイルと画像を含む ZIP ファイルがダウンロードされます。

### 3. 全記事のエクスポート

1.  ロドストの日記一覧ページ（例: `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/`）を開きます。
2.  Chrome のツールバーにある SyncStone のアイコンをクリックしてポップアップを開きます。
3.  「すべての記事をエクスポート」ボタンをクリックします。
4.  エクスポート対象の記事数が表示され、続行するかどうかの確認ダイアログが表示されます。「はい」をクリックするとエクスポートが開始されます。
5.  エクスポート中は進捗バーが表示されます。完了すると ZIP ファイルがダウンロードされます。

### 4. 他のプレイヤーの記事のエクスポート（隠し機能）

**重要**: この機能は、適切な利用を前提として提供されています。

SyncStone では、自分以外のプレイヤーの日記も同様の手順でエクスポートできます。これは以下のような場合に価値があります：

- **退会によって失われる思い出の保存**: FFXIV を完全に退会されたフレンドの日記は閲覧できなくなりますが、共に過ごした冒険の記録や大切な思い出を失わないために保存することができます。
- **共有した体験の記録**: 一緒にクリアしたコンテンツや、ともに参加したイベントなど、共有した思い出を残すための記録として活用できます。

**使用方法**:

1. エクスポートしたい他のプレイヤーの日記一覧ページを開きます
2. 自分の記事と同じ手順で「すべての記事をエクスポート」を実行します
3. システムが自動的に他のプレイヤーの記事であることを検出し、適切に処理します

**技術的な違い**:

- 他のプレイヤーの記事では、画像一覧ページにアクセスできないため、記事内に含まれる画像のみがダウンロードされます
- エクスポートされる ZIP ファイル名は `lodestone_others_complete_export.zip` となり、自分の記事（`lodestone_complete_export.zip`）と区別されます

**ご利用にあたって**:

- この機能は、思い出の保存という正当な目的でのご利用をお願いします
- プライバシーを尊重し、適切な範囲でのご利用をお願いします

### 5. エクスポートされるファイル

ダウンロードされる ZIP ファイルには、以下のものが含まれます。

- **Markdown ファイル (`.md`)**: 各記事が個別の Markdown ファイルとして保存されます。ファイル名は`001_ArticleTitle.md`形式で、重複を防ぐため連番IDが付与されます。
  - Markdown ファイルの冒頭には、YAML フロントマター形式で以下のメタデータが含まれます。
    - `title`: 記事のタイトル
    - `date`: 公開日時
    - `likes`: いいね数
    - `comments`: コメント数
    - `tags`: タグのリスト
  - 記事本文とコメント内容は Markdown 形式で記述されます。
- **`images/`フォルダ**: すべての画像（ロドスト内部画像と外部画像の両方）がダウンロードされ、このフォルダに保存されます。Markdown ファイル内の画像リンクは、このフォルダ内の画像への相対パスに書き換えられます。
- **`index.md`**: エクスポートされたすべての記事へのリンクを含む Markdown ファイルです。このファイルは、[Visual Studio Code](https://code.visualstudio.com/) などの Markdown プレビュー機能を備えたテキストエディタで開くと、エクスポートされた記事へのリンク集として便利に利用できます。

### 6. エクスポートされた Markdown ファイルの閲覧

エクスポートされた Markdown ファイルは、[Visual Studio Code](https://code.visualstudio.com/) などの Markdown プレビュー機能を備えたテキストエディタで開くことを推奨します。ZIP ファイルを展開し、Markdown ファイルと`images/`フォルダが同じ階層にあることを確認してください。これにより、Markdown プレビューで画像が正しく表示されます。

## 注意事項

- **サーバー負荷**: 全記事エクスポート機能は、ロドストのサーバーに連続してアクセスします。設定可能なアクセス間隔を適切に設定し、サーバーに過度な負荷をかけないようにご協力ください。
- **画像のダウンロード**: すべての画像（ロドスト内部画像と外部画像の両方）がダウンロードされ、ZIP ファイルに含まれます。画像のダウンロードに失敗した場合は、元の URL が Markdown ファイル内に保持されます。
- **ロドストの仕様変更**: ロドストの HTML 構造や仕様が変更された場合、本拡張機能が正常に動作しなくなる可能性があります。
- **BBCode の変換**: ロドストの BBCode は HTML に変換された状態で取得され、Turndown ライブラリによって Markdown に変換されます。特殊な記法や複雑なレイアウトは完全に再現されない場合があります。

## 技術仕様

- **TypeScript で開発**: コードの保守性と型安全性を向上させるため、TypeScript で開発されています。
- **Chrome Extension Manifest V3 対応**: 最新の Chrome 拡張機能標準に完全対応しています。
- **ビルドシステム**: 高速な開発とプロダクションビルドのために Vite を使用しています。
- **動的タイムアウト管理**: すべてのタイムアウトは、ユーザーのアクセス間隔設定に基づいて動的に計算され、一貫した動作を保証します。
- **IndexedDB ストレージ**: Chrome Service Worker のメモリ制限を回避するため、IndexedDB を使用して効率的な画像データ管理を行います。
- **ストリーミング ZIP 生成**: zip.js を利用したストリーミング ZIP 作成により、大量の画像データをメモリエラーなしで安定処理できます。

<div style="text-align: right; margin-top: 20px;">
  <div style="display: inline-block; vertical-align: middle; margin-right: 20px;">
    <img src="e6486e2b222ab797036f2c3b5bc9d4d850d052d9.jpg" alt="ありがとう、FFXIV" width="120">
  </div>
  <div style="display: inline-block; vertical-align: middle;">
    <p style="margin:0; padding:0; font-size:1.2em;">ありがとう、FFXIV</p>
  </div>
</div>
