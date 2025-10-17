# Seanime MangaFreak Extension

This is a **Seanime extension** implementation for [MangaFreak](https://ww2.mangafreak.me).

## Features

* **Search**: Searches the site using the `/Find/` endpoint.
* **Chapter Listing**: Retrieves the full chapter list for a manga, combining results from the main table and any separate "latest chapters" list to ensure all historical chapters are included.
* **Page Retrieval**: Fetches all image URLs for a specific chapter.

---

## Implementation Details for Developers

### Base URL
* `https://ww2.mangafreak.me`

### Anti-Scraping / Headers
* All requests include a standard **User-Agent header** (`Mozilla/5.0...`) to prevent **403 Forbidden errors**.

### Chapter Parsing Logic
The `findChapters` method handles the complex chapter structure on MangaFreak:
* It scrapes two different HTML blocks (`div.manga_series_list table tr` and `div.series_sub_chapter_list div a`) to capture both older and newer chapters.
* It uses a numerical sorting and sequential re-indexing process (`0, 1, 2...`) on the `index` property, ensuring chapters are always in correct reading order, regardless of how the website lists them.

### Page Parsing
* The `findChapterPages` method includes a **Referer header** set to the chapter's URL, which is often required to load the chapter images correctly from the CDN.
