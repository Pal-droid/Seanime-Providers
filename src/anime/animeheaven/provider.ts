/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
  private base = "https://animeheaven.me";

  getSettings(): Settings {
    return {
      episodeServers: ["AnimeHeaven"],
      supportsDub: false, // only sub
    };
  }

  async search(query: SearchOptions): Promise<SearchResult[]> {
    const res = await fetch(`${this.base}/search.php?s=${encodeURIComponent(query.query)}`);
    const html = await res.text();

    // Match each search result
    const regex = /<div class='similarimg'>.*?<a href='(anime\.php\?.*?)'><img.*?alt='(.*?)'/gs;
    const results: SearchResult[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = `${this.base}/${match[1]}`;
      const title = match[2].replace(/&#039;/g, "'"); // decode apostrophes
      const id = match[1].replace("anime.php?", ""); // use query string as id
      results.push({ id, title, url, subOrDub: "sub" });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id: string): Promise<Episode[]> {
    const res = await fetch(`${this.base}/anime.php?${id}`);
    const html = await res.text();

    // Match episode gate IDs and numbers
    const regex = /onclick='gate\("([a-f0-9]+)"\)'.*?>\s*<div class='watch2 bc'>(\d+)<\/div>/gs;
    const episodes: Episode[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const gateId = match[1];
      const number = parseInt(match[2]);
      episodes.push({
        id: gateId,
        title: `Episode ${number}`,
        number,
        url: `${this.base}/gate.php`, // we'll use the gate cookie for fetching
      });
    }

    return episodes;
  }

  async findEpisodeServer(episode: EpisodeDetails, _server: string): Promise<EpisodeServer> {
    // Fetch the episode page with gate cookie
    const res = await fetch(episode.url, {
      headers: {
        "Cookie": `key=${episode.id}`,
        "Referer": episode.url.replace("gate.php", `anime.php?`), // base anime page
      },
    });
    const html = await res.text();

    // Find the first .mp4 source
    const match = html.match(/<source src='(https?:\/\/.*?\.mp4\?[^\']+)'/);
    if (!match) throw new Error("Video URL not found");

    const videoUrl = match[1];

    return {
      server: "AnimeHeaven",
      headers: {
        "Cookie": `key=${episode.id}`,
        "Referer": episode.url.replace("gate.php", `anime.php?`),
      },
      videoSources: [
        {
          url: videoUrl,
          quality: "auto",
          type: "mp4",
          subtitles: [],
        },
      ],
    };
  }
}
