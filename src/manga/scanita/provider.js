class Provider {
  constructor() {
    this.api = "https://scanita.org";
  }

  api = "";

  sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async search(opts) {
    const queryParam = opts.query;
    const url = `${this.api}/search?q=${encodeURIComponent(queryParam)}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          "Accept": "*/*",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": "https://scanita.org/",
        },
      });

      if (!response.ok) {
        console.warn(`HTTP error: ${response.status} ${response.statusText}`);
        return [];
      }

      const text = await response.text();
      let html = "";

      try {
        const parsed = JSON.parse(text);
        html = typeof parsed === "string" ? parsed : parsed?.html || "";
      } catch {
        html = text;
      }

      if (!html.trim()) {
        console.warn("Empty HTML content");
        return [];
      }

      const decoded = typeof he !== "undefined" ? he.decode(html) : html;
      const entryBlockRegex = /<a[^>]+href="\/manga\/[^"]+"[\s\S]*?<\/a>/gi;

      const mangas = [];
      let block;

      while ((block = entryBlockRegex.exec(decoded)) !== null) {
        const chunk = block[0];
        const idMatch = chunk.match(/href="\/manga\/([^"]+)"/i);
        if (!idMatch) continue;
        const mangaId = idMatch[1].trim();
        const titleMatch = chunk.match(/<h3[^>]*>([^<]+)<\/h3>/i);
        const title = titleMatch ? titleMatch[1].trim() : "Untitled";
        const thumbMatch = chunk.match(/(https:\/\/cdn\.manga-italia\.com\/[^"]+?\/thumb\.[^"]+?\.webp)/i);
        let image = thumbMatch ? thumbMatch[1].trim() : null;
        if (image) {
          image = `https://images.weserv.nl/?url=${image.replace(/^https?:\/\//, "")}`;
        }
        mangas.push({
          id: mangaId,
          title,
          image,
          synonyms: undefined,
          year: undefined,
        });
      }

      if (mangas.length === 0) {
        console.warn("No search results found.");
      }

      return mangas;
    } catch (e) {
      console.error("Search error:", e.message || "Unknown error", e.stack || "No stack trace");
      return [];
    }
  }

  async findChapters(mangaId) {
    const baseUrl = `${this.api}/manga/${mangaId}`;

    try {
      this.sleep(1000);

      const response = await fetch(baseUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          "Accept": "*/*",
        },
      });

      if (!response.ok) {
        console.warn(`HTTP error: ${response.status} ${response.statusText}`);
        return [];
      }

      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;
      const moreMatch = decoded.match(/<button[^>]+data-path="([^"]+)"[^>]*>\s*Mostra di più\s*<\/button>/i);

      let chapterUrl = baseUrl;
      if (moreMatch && moreMatch[1]) {
        const path = moreMatch[1].trim();
        if (path.startsWith("http")) {
          chapterUrl = path;
        } else {
          chapterUrl = `${this.api}${path}`;
        }
      }

      this.sleep(1000);

      const chaptersResp = await fetch(chapterUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          "Accept": "*/*",
        },
      });

      if (!chaptersResp.ok) {
        console.warn(`HTTP error: ${chaptersResp.status} ${chaptersResp.statusText}`);
        return [];
      }

      const chaptersHtml = await chaptersResp.text();
      const chaptersDecoded = typeof he !== "undefined" ? he.decode(chaptersHtml) : chaptersHtml;

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
          index: 0,
        });
      }

      chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
      chapters.forEach((c, i) => (c.index = i));

      return chapters;
    } catch (e) {
      console.error("Chapter fetch error:", e.message || "Unknown error", e.stack || "No stack trace");
      return [];
    }
  }

  async findChapterPages(chapterId) {
    const pages = [];
    const visited = new Set();

    const crawl = async (url) => {
      if (visited.has(url)) return;
      visited.add(url);
      this.sleep(1000);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
          "Accept": "*/*",
        },
      });

      if (!response.ok) return;
      const html = await response.text();
      const decoded = typeof he !== "undefined" ? he.decode(html) : html;

      const imgRegex = /<div[^>]*class="[^"]*book-page[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/gi;
      let match;
      let idx = pages.length;

      while ((match = imgRegex.exec(decoded)) !== null) {
        let imgUrl = match[1].trim();
        if (imgUrl.startsWith("/")) imgUrl = `${this.api}${imgUrl}`;
        imgUrl = `https://images.weserv.nl/?url=${imgUrl.replace(/^https?:\/\//, "")}`;

        pages.push({ url: imgUrl, index: idx++, headers: { Referer: url } });
      }

      const nextMatch = decoded.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*btn-next[^"]*"[^>]*>/);
      if (nextMatch && nextMatch[1]) {
        const nextUrl = nextMatch[1].startsWith("http")
          ? nextMatch[1]
          : `${this.api}${nextMatch[1]}`;
        await crawl(nextUrl);
      }
    };

    await crawl(`${this.api}/scan/${chapterId}`);
    return pages;
  }
}