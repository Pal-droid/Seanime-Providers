// WORK IN PROGRESS

class Provider {
  constructor() {
    this.api = "{{domain}}"; // e.g., "https://bato.to"
  }

  api = "";

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

  /**
   * 🔍 Search mangas on bato.to
   */
  async search(opts) {
    const url = `${this.api}/search?word=${encodeURIComponent(opts.query)}`;

    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      // Each manga result
      const entryRegex =
        /<div class="col item line-b no-flag">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi;

      const mangas = [];
      let match;
      while ((match = entryRegex.exec(decoded)) !== null) {
        const href = match[1];
        const id = href.replace(/^\//, "");
        const image = match[2];
        const title = id.split("/").pop()?.replace(/[-_]/g, " ") || "Untitled";

        mangas.push({
          id,
          title,
          image,
        });
      }

      return mangas;
    } catch (e) {
      console.error("Search error:", e);
      return [];
    }
  }

  /**
   *  Find chapter list
   */
  async findChapters(mangaId) {
    try {
      const mangaUrl = `${this.api}/${mangaId}`;
      const resp = await this.fetchWithHeaders(mangaUrl);
      if (!resp.ok)
        throw new Error(`${resp.status} ${resp.statusText}`);

      const html = await resp.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      // Extract chapter info
      const chapterRegex =
        /<a[^>]+href="(\/chapter\/[^"]+)"[^>]*>\s*<b>([^<]+)<\/b>\s*(?:<span>\s*:\s*([^<]+)<\/span>)?/gi;

      const chapters = [];
      let match;
      while ((match = chapterRegex.exec(decoded)) !== null) {
        const href = match[1];
        const titlePart = match[2].trim();
        const subtitle = match[3]?.trim() || "";
        const fullTitle = subtitle ? `${titlePart} : ${subtitle}` : titlePart;
        const chapterNum = titlePart.match(/Chapter\s+([\d.]+)/i)?.[1] || "0";

        chapters.push({
          id: href.replace(/^\//, ""),
          url: `${this.api}${href}`,
          title: fullTitle,
          chapter: chapterNum,
        });
      }

      // Bato.to lists newest first → reverse order
      return chapters.reverse().map((c, i) => ({ ...c, index: i }));
    } catch (e) {
      console.error("findChapters error:", e);
      return [];
    }
  }

  /**
   *  Find image pages for a chapter
   */
  async findChapterPages(chapterId) {
    try {
      const url = `${this.api}/${chapterId}`;
      const response = await this.fetchWithHeaders(url);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      // Extract imgHttps array from JS
      const imgArrayMatch = decoded.match(
        /const\s+imgHttps\s*=\s*\[([^\]]+)\]/i
      );
      if (!imgArrayMatch) {
        console.warn("No imgHttps array found in chapter page");
        return [];
      }

      const rawArray = `[${imgArrayMatch[1]}]`;
      let imageUrls = [];
      try {
        imageUrls = JSON.parse(rawArray.replace(/'/g, '"'));
      } catch (err) {
        // fallback manual parse
        imageUrls = rawArray
          .split(/["']/)
          .filter((s) => s.startsWith("http"))
          .map((s) => s.trim());
      }

      const pages = imageUrls.map((imgUrl, index) => ({
        url: imgUrl,
        index,
        headers: { Referer: this.api },
      }));

      console.log(
        `Found ${pages.length} images for chapter ${chapterId} (imgHttps mode)`
      );
      return pages;
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}
