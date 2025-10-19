class Provider {
  constructor() {
    this.api = "https://scanita.org";
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
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://scanita.org/",
      },
    });
  }

  async search(opts) {
    const url = `${this.api}/search?q=${encodeURIComponent(opts.query)}`;

    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);

      const text = await response.text();

      let html;
      try {
        const parsed = JSON.parse(text);
        html = typeof parsed === "string" ? parsed : parsed?.html || "";
      } catch {
        html = text;
      }

      if (!html.trim()) return [];

      // Decode escaped unicode (\u003Cdiv → <div>)
      html = html.replace(/\\u([\dA-F]{4})/gi, (_, g) =>
        String.fromCharCode(parseInt(g, 16))
      );

      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      // Extract entries
      const entryBlockRegex = /<a[^>]+href="\/manga\/[^"]+"[\s\S]*?<\/a>/gi;
      const mangas = [];

      let match;
      while ((match = entryBlockRegex.exec(decoded)) !== null) {
        const chunk = match[0];

        const id = chunk.match(/href="\/manga\/([^"]+)"/i)?.[1];
        const title =
          chunk.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1]?.trim() ||
          // fallback: title from id
          id?.replace(/-/g, " ") || 
          "Untitled";

        const thumb = chunk.match(
          /(https:\/\/cdn\.manga-italia\.com\/[^"]+?\/(?:cover|thumb)\.[^"]+?\.webp)/i
        )?.[1];

        // Skip if no image (avoid duplicates)
        if (!thumb) continue;

        mangas.push({
          id,
          title,
          image: `https://images.weserv.nl/?url=${thumb.replace(/^https?:\/\//, "")}`,
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
      const response = await this.fetchWithHeaders(`${this.api}/manga/${mangaId}`);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const moreMatch = decoded.match(/<button[^>]+data-path="([^"]+)"/i);
      const chapterUrl = moreMatch
        ? moreMatch[1].startsWith("http")
          ? moreMatch[1]
          : `${this.api}${moreMatch[1]}`
        : `${this.api}/manga/${mangaId}`;

      const chaptersResp = await this.fetchWithHeaders(chapterUrl);
      if (!chaptersResp.ok)
        throw new Error(`${chaptersResp.status} ${chaptersResp.statusText}`);

      const chaptersHtml = await chaptersResp.text();
      const chaptersDecoded =
        typeof he !== "undefined" ? he.decode(chaptersHtml) : chaptersHtml;

      const chapterRegex =
        /<a[^>]+href="\/scan\/(\d+)"[^>]*>[\s\S]*?(?:Capitolo|Chapter|Ch\.?)\s*([0-9]+(?:\.[0-9]+)?)/gi;

      const chapters = [];
      let match;
      while ((match = chapterRegex.exec(chaptersDecoded)) !== null) {
        const chapterId = match[1];
        const chapterNum = match[2];
        chapters.push({
          id: chapterId,
          url: `${this.api}/scan/${chapterId}`,
          title: chapterNum,
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
    const pages = [];
    const visited = new Set();
    const queue = [`${this.api}/scan/${chapterId}`];

    const fetchPage = async (url) => {
      if (visited.has(url)) return;
      visited.add(url);

      const resp = await this.fetchWithHeaders(url);
      if (!resp.ok) return;

      const html = await resp.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const imgRegex =
        /<div[^>]*class="[^"]*book-page[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi;
      let m;
      while ((m = imgRegex.exec(decoded)) !== null) {
        let imgUrl = m[1].trim();
        if (imgUrl.startsWith("/")) imgUrl = `${this.api}${imgUrl}`;
        imgUrl = `https://images.weserv.nl/?url=${imgUrl.replace(
          /^https?:\/\//,
          ""
        )}`;
        pages.push({ url: imgUrl, index: pages.length, headers: { Referer: url } });
      }

      const nextMatch = decoded.match(
        /<a[^>]+href="([^"]+)"[^>]*class="[^"]*btn-next[^"]*"[^>]*>/
      );
      if (nextMatch && nextMatch[1]) {
        const nextUrl = nextMatch[1].startsWith("http")
          ? nextMatch[1]
          : `${this.api}${nextMatch[1]}`;
        queue.push(nextUrl);
      }
    };

    // Crawl concurrently (3 requests at once)
    while (queue.length > 0) {
      const batch = queue.splice(0, 3);
      await Promise.all(batch.map(fetchPage));
    }

    return pages;
  }
}