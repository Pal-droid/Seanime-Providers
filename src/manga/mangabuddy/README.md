# Seanime Mangabuddy Extension

This is a **Seanime extension** implementation for [Mangabuddy](https://mangabuddy.com).

## Features

* **Search**: Searches Mangabuddy using the `/search` endpoint, parsing HTML to extract manga entries including title, ID, and thumbnail.  
* **Chapter Listing**: Fetches all chapters for a manga using the internal `/api/manga/{bookId}/chapters` endpoint, sorting and re-indexing them numerically.  
* **Page Retrieval**: Extracts all image URLs from a chapter by decoding the `chapImages` variable in the page script.

---

## Implementation Details for Developers

### Base URL
* `https://mangabuddy.com`

### Image Proxy
* All images are proxied through `https://mangabuddy-proxy.onrender.com/proxy?url=` to ensure consistent HTTPS delivery and avoid CORS issues.

### Search Logic
* The `search` method performs a GET request to `/search?q={query}`.
* Returned HTML is decoded to handle escaped entities (via `he.decode` if available).
* Entries are extracted using a regex targeting `<div class="book-item">` blocks.  
* Each manga entry includes:
  * **ID** — extracted from `/manga/` hrefs.  
  * **Title** — extracted from `<h3><a>` elements or derived from the ID.  
  * **Thumbnail** — collected from `data-src` attributes, proxied via the image proxy URL.

### Chapter Parsing
* The `findChapters` method first retrieves the manga detail page and extracts the internal `bookId` variable (`var bookId = ...;`).  
* It then requests `https://mangabuddy.com/api/manga/{bookId}/chapters?source=detail` to get chapter data.  
* Chapters are extracted using regex from the returned HTML, capturing both **chapter title** and **href**.  
* Numeric sorting ensures chapters are ordered logically, then re-indexed (`0, 1, 2...`).

### Page Parsing
* The `findChapterPages` method loads the chapter page and looks for the variable `var chapImages = '...'`.  
* This variable contains a comma-separated list of image URLs.  
* Each image URL is proxied and returned with a **Referer** header pointing to the base site (`https://mangabuddy.com`).
