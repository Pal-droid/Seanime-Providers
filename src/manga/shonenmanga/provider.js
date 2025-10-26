class Provider {
  constructor() {
    this.api = "https://www.shonenmangaz.com";
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
    const url = `${this.api}/?s=${encodeURIComponent(opts.query)}&post_type=wp-manga`;
    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const entryBlockRegex =
        /<div class="col-4 col-lg-2 col-md-3 badge-pos-1">([\s\S]*?)<\/div>\s*<\/div>/gi;
      const mangas = [];
      let match;

      while ((match = entryBlockRegex.exec(decoded)) !== null) {
        const chunk = match[1];
        const linkMatch = chunk.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
        const titleMatch = chunk.match(/<a[^>]+title="([^"]+)"/i);
        const imgMatch = chunk.match(/data-src="([^"]+\.(?:webp|png|jpg|jpeg))"/i);

        if (!linkMatch || !imgMatch) continue;

        mangas.push({
          id: linkMatch[1].replace(this.api + "/", ""),
          title: titleMatch?.[1]?.trim() || "Untitled",
          image: imgMatch[1],
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
      const url = `${this.api}/${mangaId}`;
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const chapterRegex =
        /<div class="wp-manga-chapter manga-chapter-id-\d+">[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      const chapters = [];
      let match;

      while ((match = chapterRegex.exec(decoded)) !== null) {
        const href = match[1].trim();
        const title = match[2].trim();
        const chapterNum = title.match(/Chapter\s+([\d.]+)/i)?.[1] || "0";

        chapters.push({
          id: href.replace(this.api + "/", ""),
          url: href,
          title,
          chapter: chapterNum,
        });
      }

      // reverse because site lists newest → oldest
      return chapters
        .reverse()
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

      const imgRegex =
        /<img[^>]+class=['"]wp-manga-chapter-img[^'"]*['"][^>]+src=['"]([^'"]+)['"]/gi;
      const pages = [];
      let match;

      while ((match = imgRegex.exec(decoded)) !== null) {
        const imgUrl = match[1].trim();
        pages.push({
          url: imgUrl,
          index: pages.length,
          headers: { Referer: this.api },
        });
      }

      console.log(`Found ${pages.length} images for chapter ${chapterId}`);
      return pages;
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}