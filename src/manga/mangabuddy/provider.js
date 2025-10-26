class Provider {
  constructor() {
    this.api = "{{domain}}";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async fetchWithHeaders(url) {
    return fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${this.api}/`,
      },
    });
  }

  async search(opts) {
    const url = `${this.api}/search?q=${encodeURIComponent(opts.query)}`;
    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const entryBlockRegex = /<div\s+class="book-item">([\s\S]*?)<\/div>\s*<\/div>/gi;
      const mangas = [];
      let match;

      while ((match = entryBlockRegex.exec(decoded)) !== null) {
        const chunk = match[1];
        const id = chunk.match(/href="\/([^"]+)"/i)?.[1];
        const title =
          chunk.match(/<h3>\s*<a[^>]+title="([^"]+)"/i)?.[1]?.trim() ||
          id?.replace(/-/g, " ") ||
          "Untitled";
        const thumb = chunk.match(/data-src="([^"]+\.(?:png|jpg|jpeg))"/i)?.[1];

        if (!thumb || !id) continue;

        mangas.push({
          id,
          title,
          image: thumb.startsWith("http") ? thumb : `${this.api}${thumb}`,
        });
      }

      return mangas;
    } catch (e) {
      console.error("Search error:", e);
      return [];
    }
  }

  async findChapters(mangaId) {
    try {
      const mangaUrl = `${this.api}/${mangaId}`;
      const detailResp = await this.fetchWithHeaders(mangaUrl);
      if (!detailResp.ok) throw new Error(`${detailResp.status} ${detailResp.statusText}`);

      const detailHtml = await detailResp.text();
      const decodedDetail = typeof he !== "undefined" ? he.decode(detailHtml) : detailHtml;

      const bookIdMatch = decodedDetail.match(/var\s+bookId\s*=\s*(\d+);/i);
      const bookId = bookIdMatch?.[1];
      if (!bookId) return [];

      const apiUrl = `${this.api}/api/manga/${bookId}/chapters?source=detail`;
      const chaptersResp = await this.fetchWithHeaders(apiUrl);
      if (!chaptersResp.ok) throw new Error(`${chaptersResp.status} ${chaptersResp.statusText}`);

      const chaptersHtml = await chaptersResp.text();
      const decodedChapters = typeof he !== "undefined" ? he.decode(chaptersHtml) : chaptersHtml;

      const chapterRegex =
        /<li[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<strong[^>]*class="chapter-title"[^>]*>([^<]+)<\/strong>/gi;

      const chapters = [];
      let match;
      while ((match = chapterRegex.exec(decodedChapters)) !== null) {
        const href = match[1].trim();
        const title = match[2].trim();
        const chapterId = href.startsWith("/") ? href.slice(1) : href;
        const chapterNum = title.match(/Chapter\s+([\d.]+)/i)?.[1] || "0";

        chapters.push({
          id: chapterId,
          url: `${this.api}/${chapterId}`,
          title,
          chapter: chapterNum,
        });
      }

      return chapters
        .sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter))
        .map((c, i) => ({ ...c, index: i }));
    } catch (e) {
      console.error("findChapters error:", e);
      return [];
    }
  }

  async findChapterPages(chapterId) {
    try {
      const url = `${this.api}/${chapterId}`;
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const imgVarMatch = decoded.match(/var\s+chapImages\s*=\s*'([^']+)'/i);
      if (!imgVarMatch || !imgVarMatch[1]) return [];

      const rawImages = imgVarMatch[1]
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean);

      const pages = rawImages.map((imgUrl, index) => ({
        url: imgUrl.startsWith("http") ? imgUrl : `${this.api}${imgUrl}`,
        index,
        headers: { Referer: this.api },
      }));

      console.log(`Found ${pages.length} images for chapter ${chapterId} (direct-only mode)`);
      return pages;
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}