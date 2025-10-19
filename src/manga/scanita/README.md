# Seanime Scanita Extension

This is a **Seanime extension** implementation for [Scanita](https://scanita.org).

## Features

* **Search**: Searches Scanita using the `/search` endpoint, decoding HTML responses and extracting manga entries with title, ID, and thumbnail.  
* **Chapter Listing**: Retrieves all chapters for a manga, following any “load more” buttons and ensuring results are sorted numerically.  
* **Page Retrieval**: Iteratively crawls all pages for a chapter, following “Next” links and collecting every image URL.

---

## Implementation Details for Developers

### Base URL
* `https://scanita.org`

### Anti-Scraping / Headers
* All requests include a mobile **User-Agent**, **X-Requested-With**, and **Referer** header to avoid being blocked by Cloudflare and to mimic browser requests.

### Search Logic
* The `search` method decodes HTML that may be returned as escaped JSON.
* It extracts entries using a regex for `<a>` blocks containing `/manga/` links and image elements.
* Images are proxied through `images.weserv.nl` for consistent HTTPS access.

### Chapter Parsing
* The `findChapters` method detects and follows any `data-path` attribute from “load more” buttons.
* Chapters are sorted numerically and re-indexed sequentially (`0, 1, 2...`).

### Page Parsing
* The `findChapterPages` method recursively follows “Next” buttons to gather all pages.
* Each image includes a **Referer header** pointing to the current page to ensure images load correctly from the CDN.