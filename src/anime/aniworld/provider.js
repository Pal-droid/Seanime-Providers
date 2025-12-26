/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
  constructor() {
    this.base = "https://aniworld.to";
  }

  getSettings() {
    return {
      episodeServers: ["VidMoly"],
      supportsDub: true,
    };
  }

  async search(query) {
    const res = await fetch(`${this.base}/ajax/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `keyword=${encodeURIComponent(query.query)}`,
    });

    const data = await res.json();
    
    return data
      .filter(item => item.link.startsWith("/anime/stream/"))
      .map(item => ({
        id: item.link.replace("/anime/stream/", ""),
        title: item.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/&#8230;/g, "..."),
        url: `${this.base}${item.link}`,
        subOrDub: "sub",
      }));
  }

  async findEpisodes(id) {
    const res = await fetch(`${this.base}/anime/stream/${id}`);
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

    /* 1. Isolation: Use a tempered greedy token to ensure we find Vidmoly 
       only within its own <li> and don't accidentally grab VOE's redirect path. */
    const vidmolyLiRegex = /<li[^>]+data-link-target="([^"]+)"[^>]*>(?:(?!<\/li>)[\s\S])*?icon Vidmoly[\s\S]*?<\/li>/;
    const liMatch = html.match(vidmolyLiRegex);
    
    if (!liMatch) throw new Error("Vidmoly hoster not found for this episode");

    const redirectUrl = `${this.base}${liMatch[1]}`;

    // 2. Fetch Vidmoly embed (Follows 302 automatically)
    const hosterRes = await fetch(redirectUrl);
    const hosterHtml = await hosterRes.text();

    /* 3. Robust Extraction: Specifically matches the master.m3u8 link.
       It looks for the 'file' key and handles any quote style or whitespace. */
    const m3u8Regex = /file\s*:\s*["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/;
    const fileMatch = hosterHtml.match(m3u8Regex);

    if (!fileMatch) {
      // Final fallback if the player structure changes slightly
      const fallbackRegex = /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/;
      const fallbackMatch = hosterHtml.match(fallbackRegex);
      
      if (!fallbackMatch) throw new Error("Could not locate master.m3u8 source");
      
      return {
        server: "VidMoly",
        videoSources: [{ url: fallbackMatch[1], quality: "auto", type: "hls" }],
      };
    }

    return {
      server: "VidMoly",
      videoSources: [
        {
          url: fileMatch[1],
          quality: "auto",
          type: "hls",
        },
      ],
    };
  }
}
