# SyncStone - Stardust Memoir Chrome Extension

SyncStone, named "Stardustmemoir", is a playful nod to FINAL FANTASY XIV's scenario titles. This extension operates as a standalone Chrome extension designed to export your diary entries from The Lodestone (FINAL FANTASY XIV's official player site) into Markdown format for local storage. Since The Lodestone lacks an export function, the primary goal is to help you back up your precious memories.

## Features

*   **Export Single Article**: Exports the current Lodestone diary article page or diary editing page, including the article title, body, images (Lodestone internal images only), comments, likes, publication date, and tags. It downloads a ZIP file containing the Markdown file and associated images.
*   **Export All Articles**: Exports all diary entries from The Lodestone's diary list page, including article titles, bodies, images (Lodestone internal images only), comments, likes, publication dates, and tags. It converts them to Markdown format and downloads them as a single ZIP file. All internal Lodestone images are also downloaded and included in an `images/` folder within the ZIP file.
*   **Comment Retrieval**: Retrieves the full text of comments associated with articles and includes them in the Markdown files.
*   **Bulk Image Download**: When exporting all articles, all images from The Lodestone's image management page are pre-downloaded and included in the ZIP file. This prevents duplicate downloads of images referenced across multiple articles and ensures images are displayed correctly when viewed locally.
*   **Article List Generation**: When exporting all articles, a `Article_List.md` file is generated within the ZIP file, containing links to all exported articles. This file can be conveniently used as a collection of links to your exported articles when opened with Markdown preview-enabled text editors like [Visual Studio Code](https://code.visualstudio.com/).

## Installation

1.  Clone or download this repository.
2.  Open Chrome browser and navigate to `chrome://extensions`.
3.  Toggle on "Developer mode" in the top right corner.
4.  Click on the "Load unpacked" button.
5.  Select the `chrome-extension` folder within the downloaded or cloned repository.
6.  The SyncStone extension will be added to Chrome.

## Usage

### 1. Setting Access Interval

When you open the extension's popup, you'll find an input field for "Access Interval (milliseconds)". This sets the waiting time between consecutive accesses to The Lodestone's server. To consider server load, the default is set to 2000 milliseconds (2 seconds) and cannot be set to less than 2000 milliseconds. Adjust as needed.

### 2. Exporting a Single Article

1.  Open the Lodestone diary article page or diary editing page you wish to export.
2.  Click the SyncStone icon in your Chrome toolbar to open the popup.
3.  Click the "Export Current Article" button.
4.  A ZIP file containing the Markdown file and images will be downloaded.

### 3. Exporting All Articles

1.  Open The Lodestone's diary list page (e.g., `https://jp.finalfantasyxiv.com/lodestone/character/YOUR_CHARACTER_ID/blog/`).
2.  Click the SyncStone icon in your Chrome toolbar to open the popup.
3.  Click the "Export All Articles" button.
4.  A confirmation dialog will appear, showing the number of articles to be exported and asking if you wish to proceed. Click "Yes" to start the export.
5.  A progress bar will be displayed during the export. Once completed, a ZIP file will be downloaded.

### 4. Exported Files

The downloaded ZIP file will contain the following:

*   **Markdown files (`.md`)**: Each article is saved as a separate Markdown file. The filename will be based on the article's title.
    *   The beginning of each Markdown file will include the following metadata in YAML front matter format:
        *   `title`: Article title
        *   `date`: Publication date
        *   `likes`: Number of likes
        *   `comments`: Number of comments
        *   `tags`: List of tags
    *   Article body and comment body will be in Markdown format.
*   **`images/` folder**: Lodestone internal images (`finalfantasyxiv.com` domain images) are downloaded and saved in this folder. Image links within Markdown files will be rewritten to relative paths within this folder.
*   **`Article_List.md`**: A Markdown file containing links to all exported articles. This file can be conveniently used as a collection of links to your exported articles when opened with Markdown preview-enabled text editors like [Visual Studio Code](https://code.visualstudio.com/).

### 5. Viewing Exported Markdown Files

It is recommended to open the exported Markdown files with a text editor that supports Markdown preview, such as [Visual Studio Code](https://code.visualstudio.com/). Ensure that the ZIP file is extracted and the Markdown files and `images/` folder are in the same directory. This will allow images to be displayed correctly in the Markdown preview.

## Important Notes

*   **Server Load**: The "Export All Articles" feature accesses The Lodestone's server consecutively. Please set the configurable access interval appropriately to avoid placing excessive load on the server.
*   **External Images**: Images from domains other than The Lodestone will not be downloaded and will remain linked with their original URLs in the Markdown files.
*   **Lodestone Specification Changes**: If The Lodestone's HTML structure or specifications change, this extension may not function correctly.
*   **BBCode Conversion**: Lodestone's BBCode is retrieved as converted HTML and then converted to Markdown by the Turndown library. Special notations or complex layouts may not be perfectly reproduced.
