# SyncStone - Stardustmemoir Chrome 扩展程序

SyncStone，名为“Stardustmemoir”，是与 FINAL FANTASY XIV 相关的非官方工具。此扩展程序作为独立的 Chrome 扩展程序运行，旨在将您在 The Lodestone（《最终幻想XIV》官方玩家网站）上的日记条目导出为 Markdown 格式，以便本地存储。由于 The Lodestone 缺少导出功能，主要目标是帮助您备份珍贵的回忆。

<p align="center">
  <img src="28445b1c091759ab82531cc3a64b5ca7ced45c89.jpg" alt="kako-jun">
</p>

## 功能

*   **导出单个文章**: 导出当前的 Lodestone 日记文章页面或日记编辑页面，包括文章标题、正文、所有图片（内部和外部）、评论、点赞、发布日期和标签。它会下载一个包含 Markdown 文件和相关图片的 ZIP 文件。
*   **导出所有文章**: 导出 The Lodestone 日记列表页面中的所有日记条目，包括文章标题、正文、所有图片（内部和外部）、评论、点赞、发布日期和标签。它将它们转换为 Markdown 格式，并作为包含文章和图片的统一 ZIP 文件下载。所有图片都会被下载并包含在 ZIP 文件中的 `images/` 文件夹中。
*   **评论检索**: 检索与文章相关的评论的完整文本，并将其包含在 Markdown 文件中。
*   **批量图片下载**: 导出所有文章时，The Lodestone 图片管理页面中的所有图片都会预先下载并包含在 ZIP 文件中。这可以防止重复下载在多篇文章中引用的图片，并确保在本地查看时图片正确显示。
*   **文章列表生成**: 导出所有文章时，会在 ZIP 文件中生成一个 `Article_List.md` 文件，其中包含指向所有导出文章的链接。当使用支持 Markdown 预览的文本编辑器（如 [Visual Studio Code](https://code.visualstudio.com/)）打开时，此文件可以方便地用作导出文章的链接集合。

## 安装

1.  克隆或[下载](https://github.com/kako-jun/sync-stone/archive/refs/heads/main.zip)此存储库。
2.  打开 Chrome 浏览器并导航到 `chrome://extensions`。
3.  在右上角打开“开发者模式”。
4.  点击“加载已解压的扩展程序”按钮。
5.  选择下载或克隆的存储库中的 `chrome-extension` 文件夹。
6.  SyncStone 扩展程序将添加到 Chrome。

## 使用方法

### 1. 设置访问间隔

当您打开扩展程序的弹出窗口时，您会找到一个"访问间隔"的输入字段。这设置了连续访问 The Lodestone 服务器之间的等待时间（以毫秒为单位）。考虑到服务器负载，默认设置为 2000 毫秒（2 秒），并且不能设置为小于 2000 毫秒。根据需要进行调整。

### 2. 导出单个文章

1.  打开您要导出的 Lodestone 日记文章页面（例如：`https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/ARTICLE_ID/`）。
2.  点击 Chrome 工具栏中的 SyncStone 图标以打开弹出窗口。
3.  点击"Export Current Article"按钮。
4.  将下载一个包含 Markdown 文件和图片的 ZIP 文件。

### 3. 导出所有文章

1.  打开 The Lodestone 的日记列表页面（例如：`https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/`）。
2.  点击 Chrome 工具栏中的 SyncStone 图标以打开弹出窗口。
3.  点击"Export All Articles"按钮。
4.  将出现一个确认对话框，显示要导出的文章数量并询问您是否要继续。点击"是"开始导出。
5.  导出期间将显示进度条。完成后，将下载一个 ZIP 文件。

### 4. 导出其他玩家的文章（隐藏功能）

**重要**：此功能需要适当使用。

SyncStone 也可以使用相同的程序导出其他玩家的日记条目。这在以下情况下很有价值：

- **保存因账户删除而可能丢失的回忆**：当朋友完全退出 FFXIV 时，他们的日记将无法访问。您可以保存共同冒险的记录和珍贵的回忆，防止它们丢失。
- **记录共同体验**：一起完成的活动、一起参加的事件以及其他共同回忆可以作为记录保存。

**使用方法**：
1. 打开您要导出文章的其他玩家的日记列表页面
2. 按照与您自己文章相同的程序，点击"Export All Articles"
3. 系统会自动检测这些是其他玩家的文章并适当处理它们

**技术差异**：
- 对于其他玩家的文章，图片库页面无法访问，因此只会下载文章中包含的图片
- 导出的 ZIP 文件将命名为 `lodestone_others_complete_export.zip`，以与您自己的文章（`lodestone_complete_export.zip`）区分

**使用指南**：
- 请将此功能用于保存回忆的合法目的
- 请尊重隐私并在适当范围内使用

### 5. 导出的文件

下载的 ZIP 文件将包含以下内容：

*   **Markdown 文件 (`.md`)**: 每篇文章都保存为单独的 Markdown 文件。文件名将为 `001_文章标题.md` 格式，带有顺序ID前缀以避免重复。
    *   每个 Markdown 文件的开头将包含以下 YAML front matter 格式的元数据：
        *   `title`: 文章标题
        *   `date`: 发布日期
        *   `likes`: 点赞数
        *   `comments`: 评论数
        *   `tags`: 标签列表
    *   文章正文和评论正文将采用 Markdown 格式。
*   **`images/` 文件夹**: Lodestone 内部图片（`finalfantasyxiv.com` 域图片）将下载并保存到此文件夹中。Markdown 文件中的图片链接将被重写为此文件夹中的相对路径。
*   **`index.md`**: 一个 Markdown 文件，包含指向所有导出文章的链接。当使用支持 Markdown 预览的文本编辑器（如 [Visual Studio Code](https://code.visualstudio.com/)）打开时，此文件可以方便地用作导出文章的链接集合。

### 6. 查看导出的 Markdown 文件

建议使用支持 Markdown 预览的文本编辑器（如 [Visual Studio Code](https://code.visualstudio.com/)）打开导出的 Markdown 文件。确保 ZIP 文件已解压，并且 Markdown 文件和 `images/` 文件夹位于同一目录中。这将使图片在 Markdown 预览中正确显示。

## 重要提示

*   **服务器负载**: “导出所有文章”功能会连续访问 The Lodestone 的服务器。请适当设置可配置的访问间隔，以避免对服务器造成过大的负载。
*   **外部图片**: 来自 The Lodestone 以外域名的图片将不会被下载，并将在 Markdown 文件中保留其原始 URL 链接。
*   **Lodestone 规范更改**: 如果 The Lodestone 的 HTML 结构或规范发生变化，此扩展程序可能无法正常运行。
*   **BBCode 转换**: Lodestone 的 BBCode 将作为转换后的 HTML 获取，然后由 Turndown 库转换为 Markdown。特殊符号或复杂布局可能无法完美再现。

## 技术规格

*   **使用 TypeScript 开发**: 使用 TypeScript 开发，以提高代码可维护性和类型安全性。
*   **Chrome Extension Manifest V3 兼容**: 完全兼容最新的 Chrome 扩展程序标准。
*   **构建系统**: 使用 Vite 进行快速开发和生产构建。
*   **动态超时管理**: 所有超时都根据用户的访问间隔设置动态计算，确保一致的行为。
*   **IndexedDB 存储**: 使用 IndexedDB 进行高效的图片数据管理，避免 Chrome Service Worker 的内存限制。
*   **流式 ZIP 生成**: 利用 zip.js 进行流式 ZIP 创建，实现大量图片数据的稳定处理，无内存错误。

<div style="text-align: right; margin-top: 20px;">
  <div style="display: inline-block; vertical-align: middle; margin-right: 20px;">
    <img src="e6486e2b222ab797036f2c3b5bc9d4d850d052d9.jpg" alt="Thank you FFXIV" width="120">
  </div>
  <div style="display: inline-block; vertical-align: middle;">
    <p style="margin:0; padding:0; font-size:1.2em;">谢谢你，FF14</p>
  </div>
</div>