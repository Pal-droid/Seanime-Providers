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
      // 1. Extract and strip "Season X" from the query for the search request
      const seasonMatch = query.query.match(/season\s+(\d+)/i);
      const cleanQuery = query.query.replace(/season\s+\d+/i, "").trim();
      const seasonSuffix = seasonMatch ? `|season:${seasonMatch[1]}` : "";

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
          // Append season info to ID so findEpisodes knows to switch seasons
          id: item.link.replace("/anime/stream/", "") + seasonSuffix,
          title: item.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/&#8230;/g, "..."),
          url: `${this.base}${item.link}`,
          subOrDub: "sub",
        }));
    } catch (e) {
      return [];
    }
  }

  async findEpisodes(id) {
    const [slug, seasonNumber] = id.split("|season:");
    let url = `${this.base}/anime/stream/${slug}`;

    // 2. If a specific season was requested, find the "Staffel" link on the page
    if (seasonNumber) {
      const res = await fetch(url);
      const html = await res.text();
      
      // Look for: <a href="/anime/stream/slug/staffel-X" ...>X</a>
      const seasonRegex = new RegExp(`href="([^"]+\/staffel-${seasonNumber})"[^>]*>\\s*${seasonNumber}\\s*<\/a>`, "i");
      const match = html.match(seasonRegex);
      
      if (match) {
        url = `${this.base}${match[1]}`;
      }
    }

    const res = await fetch(url);
    const html = await res.text();

    const regex = /<tr[^>]*data-episode-id="(\d+)"[^>]*>.*?<meta itemprop="episodeNumber" content="(\d+)".*?<a itemprop="url" href="([^"]+)">/gs;
    const episodes = [];
    let match;

    while ((match = regex.exec(html)) !== null) {
      episodes.push({
        id: match[1],
        title: `Episode ${match[2]}`,
        number: parseInt(match[2]),
        url: `${this.base}${match[3]}`,
      });
    }

    return episodes;
  }

  async findEpisodeServer(episode, _server) {
    const res = await fetch(episode.url);
    const html = await res.text();

    // Isolate Vidmoly <li> block
    const vidmolyLiRegex = /<li[^>]+data-link-target="([^"]+)"[^>]*>(?:(?!<\/li>)[\s\S])*?icon Vidmoly[\s\S]*?<\/li>/;
    const liMatch = html.match(vidmolyLiRegex);
    
    if (!liMatch) throw new Error("Vidmoly hoster not found");

    const redirectUrl = `${this.base}${liMatch[1]}`;

    const hosterRes = await fetch(redirectUrl);
    const hosterHtml = await hosterRes.text();

    // Extract m3u8 from Vidmoly player script
    const m3u8Regex = /file\s*:\s*["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/;
    const fileMatch = hosterHtml.match(m3u8Regex);

    const videoUrl = fileMatch ? fileMatch[1] : null;
    if (!videoUrl) {
        // Fallback search for any m3u8
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
