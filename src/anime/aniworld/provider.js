/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
  constructor() {
    this.base = "https://aniworld.to";
  }

  getSettings() {
    return {
      episodeServers: ["VidMoly"],
      supportsDub: false,
    };
  }

  async search(query) {
    try {
      const seasonMatch = query.query.match(/season\s+(\d+)/i);
      const movieMatch = query.query.match(/\bmovie\b/i);
      
      const cleanQuery = query.query
        .replace(/season\s+\d+/i, "")
        .replace(/\bmovie\b/i, "")
        .trim();

      let suffix = "";
      if (seasonMatch) suffix = `|season:${seasonMatch[1]}`;
      else if (movieMatch) suffix = `|movie`;

      const res = await fetch(`${this.base}/ajax/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `${this.base}/`,
        },
        body: `keyword=${encodeURIComponent(cleanQuery)}`,
      });

      const text = await res.text();
      if (!text || text.startsWith("<!DOCTYPE")) return [];

      const data = JSON.parse(text);
      if (!Array.isArray(data)) return [];

      return data
        .filter(item => item.link && item.link.startsWith("/anime/stream/"))
        .map(item => ({
          id: item.link.replace("/anime/stream/", "") + suffix,
          title: item.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/&#8230;/g, "..."),
          url: `${this.base}${item.link}`,
          subOrDub: "sub",
        }));
    } catch (e) {
      return [];
    }
  }

  async findEpisodes(id) {
    const [slug, flag] = id.split("|");
    let url = `${this.base}/anime/stream/${slug}`;

    if (flag) {
      const res = await fetch(url);
      const html = await res.text();

      if (flag.startsWith("season:")) {
        const seasonNumber = flag.split(":")[1];
        const seasonRegex = new RegExp(`href="([^"]+\/staffel-${seasonNumber})"[^>]*>\\s*${seasonNumber}\\s*<\/a>`, "i");
        const match = html.match(seasonRegex);
        if (match) url = `${this.base}${match[1]}`;
      } 
      else if (flag === "movie") {
        const movieRegex = /href="([^"]+\/filme)"[^>]*>Filme<\/a>/i;
        const match = html.match(movieRegex);
        if (match) url = `${this.base}${match[1]}`;
      }
    }

    const res = await fetch(url);
    const html = await res.text();

    if (flag === "movie") {
      const movieRowRegex = /<tr[^>]*data-episode-id="(\d+)"[^>]*>.*?<td class="seasonEpisodeTitle"><a href="([^"]+)">\s*<strong>(.*?)<\/strong>\s*(?:-?\s*<span>(.*?)<\/span>)?/gs;
      
      let allMovies = [];
      let match;
      while ((match = movieRowRegex.exec(html)) !== null) {
        const [_, epId, epUrl, strongTitle, spanTitle] = match;
        const rawSpan = spanTitle || "";
        
        // Clean title for display
        let cleanTitle = (strongTitle.trim() || rawSpan.trim() || "Movie")
          .replace(/\[movie\]/i, "")
          .replace(/\[ova\]/i, "")
          .trim();

        allMovies.push({
          id: epId,
          title: cleanTitle,
          number: 1, // Movie is treated as a single entry
          url: `${this.base}${epUrl}`,
          isMovieLabel: rawSpan.toLowerCase().includes("[movie]") || strongTitle.toLowerCase().includes("movie")
        });
      }

      // Return ONLY the most likely movie
      // Priority: 1. Contains "[Movie]" tag, 2. First item in the list
      const likelyMovie = allMovies.find(m => m.isMovieLabel) || allMovies[0];
      return likelyMovie ? [likelyMovie] : [];

    } else {
      const epRegex = /<tr[^>]*data-episode-id="(\d+)"[^>]*>.*?<meta itemprop="episodeNumber" content="(\d+)".*?<a itemprop="url" href="([^"]+)">/gs;
      const episodes = [];
      let match;
      while ((match = epRegex.exec(html)) !== null) {
        episodes.push({
          id: match[1],
          title: `Episode ${match[2]}`,
          number: parseInt(match[2]),
          url: `${this.base}${match[3]}`,
        });
      }
      return episodes;
    }
  }

  async findEpisodeServer(episode, _server) {
    const res = await fetch(episode.url);
    const html = await res.text();

    const vidmolyLiRegex = /<li[^>]+data-link-target="([^"]+)"[^>]*>(?:(?!<\/li>)[\s\S])*?icon Vidmoly[\s\S]*?<\/li>/;
    const liMatch = html.match(vidmolyLiRegex);

    if (!liMatch) throw new Error("Vidmoly hoster not found");

    const redirectUrl = `${this.base}${liMatch[1]}`;
    const hosterRes = await fetch(redirectUrl);
    const hosterHtml = await hosterRes.text();

    const m3u8Regex = /file\s*:\s*["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/;
    const fileMatch = hosterHtml.match(m3u8Regex);

    const videoUrl = fileMatch ? fileMatch[1] : null;
    if (!videoUrl) {
        const fallback = hosterHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (!fallback) throw new Error("M3U8 not found");
        return {
            server: "VidMoly",
            videoSources: [{ url: fallback[1], quality: "auto", type: "hls" }]
        };
    }

    return {
      server: "VidMoly",
      videoSources: [{ url: videoUrl, quality: "auto", type: "hls" }],
    };
  }
}
