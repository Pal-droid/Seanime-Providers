/// <reference path='./online-streaming-provider.d.ts' />
/// <reference path='./doc.d.ts' />

class Provider {
  api = 'https://toonitalia.xyz';
  threshold = 0.7;

  getSettings() {
    // ToonItalia typically offers streams on VOE.
    return {
      episodeServers: ['VOE'],
      supportsDub: true, // Content is in Italian dub (ITA)
    };
  }

  async search(query) {
    const normalizedQuery = this.normalizeQuery(query['query']);
    console.log('Normalized Query: ' + normalizedQuery);

    // 1. Get AniList details for similarity comparison
    let aniListData = await getAniListMangaDetails(query['query']);
    const aniListTitlesAndSynonyms = [...aniListData.title, ...aniListData.synonyms];

    // 2. Perform search on ToonItalia.xyz
    const searchUrl = `${this.api}/?s=${encodeURIComponent(normalizedQuery)}`;
    const data = await this._makeRequest(searchUrl);

    if (data.includes("Nessun risultato")) {
      throw new Error("No results found on ToonItalia");
    }

    // LoadDoc is still needed for search, but avoided in findEpisodes now.
    const $ = LoadDoc(data);

    const animes = [];
    const validTitles = [];

    // Search results are listed within <article class="post"> structures
    $('article.post').each(
      (index, element) => {
        const h2Tag = element.find('h2.entry-title a');
        const rawHref = h2Tag.attr('href') ?? '';
        const title = h2Tag.text().trim();

        if (!rawHref) return;

        // The ID is the path part of the URL, excluding the base API
        let id = rawHref.replace(this.api, '');

        // Title normalization for similarity check (remove common Italian tags)
        let titleToCompare = title.toLowerCase().replace(/\s*\(\s*ita\s*\)\s*/gi, "").trim();

        const searchResult = {
          id: id,
          url: rawHref,
          title: title,
          subOrDub: 'dub' // ToonItalia is primarily Italian Dubbed
        };
        
        let bestScore = filterBySimilarity(titleToCompare, aniListTitlesAndSynonyms, this.threshold);
        if (bestScore != null) {
          validTitles.push({ title, score: bestScore, result: searchResult });
        }
        
        animes.push(searchResult);
      }
    );

    // 3. Filter results based on AniList similarity
    if (validTitles.length > 0) {
      // Return the best match based on similarity score
      let bestMatch = validTitles.reduce((prev, current) => (prev.score > current.score) ? prev : current);
      return [bestMatch.result];
    }
    
    // If no strong match, but some results were found, return the first one (fallback)
    if (animes.length > 0) {
        return [animes[0]];
    }

    throw new Error("No results found or similarity too low.");
  }

  async findEpisodes(id, query) {
    const originalQuery = query?.['query'] || '';
    
    console.log(`findEpisodes originalQuery: ${originalQuery}`);
    
    const url = `${this.api}${id}`;
    const data = await this._makeRequest(url);
    
    if (typeof data !== 'string' || data.length === 0) {
        throw new Error("Failed to fetch episode page content or content was empty.");
    }
    
    // 1. Determine the requested season number from the original query
    const requestedSeason = this.extractSeasonNumber(originalQuery);
    console.log(`Requested Season: ${requestedSeason}`);

    let episodes = [];
    let processedUrls = new Set();
    // Regex for episode links: Episode Num - Episode Title - <a href="VOE_URL">VOE</a>
    const episodeRegex = /(\d+)\s*&#8211;\s*(.*?)\s*&#8211;\s*<a[^>]*href=["']([^"']*)["'][^>]*>VOE<\/a>/gi;
    let targetHtmlContent = data; // Default to full page content

    // 2. If a season is requested, use regex to find the start and end anchors for precise isolation
    if (requestedSeason !== null) {
        
        // Use a flexible regex to find the start marker: <p><a name="S#"></a></p>
        // This handles variable whitespace and quote types.
        const startRegex = new RegExp(`(<p>\\s*<a\\s+name=["']S${requestedSeason}["']><\\/a>\\s*<\\/p>)`, 'i');
        const startMatch = data.match(startRegex);

        if (startMatch) {
            
            // Content starts immediately after the matched anchor tag string
            const contentAfterStart = data.substring(startMatch.index + startMatch[1].length);
            
            // Define the next season's anchor marker to determine the end of the block
            const nextSeason = requestedSeason + 1;
            const nextMarkerRegex = new RegExp(`(<p>\\s*<a\\s+name=["']S${nextSeason}["']><\\/a>\\s*<\\/p>)`, 'i');

            // Find the index of the next marker within the remaining content
            const endMatch = contentAfterStart.match(nextMarkerRegex);

            if (endMatch) {
                // Isolate the content block: start of content up to where the next anchor begins
                targetHtmlContent = contentAfterStart.substring(0, endMatch.index);
                console.log(`Successfully isolated content for Season ${requestedSeason} between flexible anchors.`);
            } else {
                // No next marker found, assume it's the last season
                targetHtmlContent = contentAfterStart;
                console.log(`Successfully isolated content for final Season ${requestedSeason} to end of document.`);
            }
        } else {
            console.warn(`Could not find start anchor tag for S${requestedSeason}. Falling back to full page scrape.`);
        }
    } else {
        console.log("No season requested. Scraping all available episodes from the page.");
    }
    
    // 3. Run the regex on the target content (isolated season block or full page)
    let match;
    while ((match = episodeRegex.exec(targetHtmlContent)) !== null) {
      const epNum = parseInt(match[1].trim(), 10);
      const epTitle = match[2].trim();
      const voeUrl = match[3];

      // Only process valid VOE links and prevent duplicates
      if (voeUrl && voeUrl.includes('voe.sx') && !processedUrls.has(voeUrl)) {
          processedUrls.add(voeUrl);
          
          episodes.push({
              id: voeUrl,
              url: voeUrl,
              title: epTitle,
              number: epNum,
          });
      }
    }

    if (episodes.length === 0) {
        if (requestedSeason !== null) {
             throw new Error(`No episodes found for Season ${requestedSeason}.`);
        }
      throw new Error("No episodes found using the expected regex pattern.");
    }

    // Sort episodes by number
    episodes.sort((a, b) => a.number - b.number);
    
    return episodes;
  }

  async findEpisodeServer(
    episode,
    _server
  ) {
    let server = 'VOE'; 
    if (_server !== 'default' && _server.toUpperCase() === 'VOE') server = 'VOE';

    if (server === 'VOE' && episode.url.includes('voe.sx')) {
      const videoUrl = await this.extractVoeVideoUrl(episode.url);

      if (videoUrl) {
        return {
          server: server,
          headers: {
            Referer: this.api,
            "Access-Control-Allow-Origin": "*"
          },
          videoSources: [
            {
              quality: '720p', // Assumed quality based on standard voe streams
              subtitles: [],
              type: 'mp4',
              url: videoUrl
            }
          ],
        };
      }
    }
    throw new Error(`No video source found for server: ${server}`);
  }

  // --- PRIVATE UTILITY FUNCTIONS ---

  async _makeRequest(url, redirect = 'follow') {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
        Referer: this.api,
      },
      redirect: redirect,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText} from ${url}`);
    }
    const body = await response.text();
    return body;
  }

  normalizeQuery(query) {
    const extras = [
      'OVA', 'SPECIAL', 'RECAP', 'FINAL SEASON', 'BONUS', 'SIDE STORY', 'UNCENSORED',
      'PART\\s*\\d+', 'EPISODE\\s*\\d+', 'SERIE', 'STAGIONE' // Added Italian/Generic season terms for removal
    ];

    const pattern = new RegExp(`\\b(${extras.join('|')})\\b`, 'gi');

    let normalizedQuery = query
      .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
      .replace(/(\d+)\s*Season/i, '$1')
      .replace(/Season\s*(\d+)/i, '$1')
      .replace(/\bS\s*(\d+)/gi, '$1') // Remove S1, S2, etc.
      .replace(pattern, '')
      .replace(/-.*?-/g, '')
      .replace(/\bThe(?=\s+Movie\b)/gi, '')
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalizedQuery;
  }

  /**
   * Extracts the season number (e.g., 1, 2) from a given query string.
   * Checks for patterns like "Season X", "S X", or "Stagione X".
   * @param query The user search query (e.g., "Blue Lock S2")
   * @returns The season number as a number, or null if not found.
   */
  extractSeasonNumber(query) {
    // Regex to capture "Season X", "S X", or "Stagione X". Now allows optional zero prefix (S02)
    const match = query.match(/(season|stagione|s)\s*(0*)(\d+)/i);
    if (match && match[3]) {
      const season = parseInt(match[3], 10);
      return isNaN(season) ? null : season;
    }
    return null;
  }

  /**
   * Handles the complex multi-step redirection and scraping for a VOE stream.
   * @param voeUrl The initial voe.sx URL.
   * @returns The final direct MP4 URL.
   */
  async extractVoeVideoUrl(voeUrl) {
    // 1. Fetch initial VOE URL (voe.sx/xyz) to get the first redirect
    let body1 = await this._makeRequest(voeUrl);
    let redirectMatch1 = body1.match(/window\.location\.href\s*=\s*'([^']*)'/);
    
    if (!redirectMatch1 || !redirectMatch1[1]) {
        console.error("VOE: Could not find first redirect URL in script.");
        return null;
    }
    // The redirect URL points to an intermediate domain (e.g., walterprettytheir.com/xyz)
    let intermediateUrl1 = redirectMatch1[1]; 
    console.log(`VOE: Intermediate URL 1: ${intermediateUrl1}`);

    // 2. Fetch the first intermediate page and scrape the /download link
    let body2 = await this._makeRequest(intermediateUrl1);
    let $2 = LoadDoc(body2);
    // Scrape the download button link
    let downloadLink = $2('a.download-user-file').attr('href');

    if (!downloadLink) {
        console.error("VOE: Could not find download link on intermediate page.");
        // Fallback: If download button not found, try to see if the video is embedded directly.
        let videoMatch = body2.match(/source src="([^"]*)"/);
        if (videoMatch && videoMatch[1]) return videoMatch[1];
        return null;
    }
    
    // The download link is relative (e.g., /xyz/download). Construct the absolute URL.
    let downloadUrl = new URL(downloadLink, intermediateUrl1).href;
    console.log(`VOE: Download URL: ${downloadUrl}`);

    // 3. Fetch the download URL to get the second redirect (e.g., christopheruntilpoint.com/xyz/download)
    let body3 = await this._makeRequest(downloadUrl);
    let redirectMatch2 = body3.match(/window\.location\.href\s*=\s*'([^']*)'/);
    
    if (!redirectMatch2 || !redirectMatch2[1]) {
        console.error("VOE: Could not find second redirect URL.");
        return null;
    }
    let intermediateUrl2 = redirectMatch2[1];
    console.log(`VOE: Intermediate URL 2 (Final Page): ${intermediateUrl2}`);


    // 4. Fetch the final intermediate page and scrape the direct MP4 link
    let body4 = await this._makeRequest(intermediateUrl2);
    let $4 = LoadDoc(body4);

    // Look for the direct download link with a .mp4 extension
    let finalMp4Link = $4('a[href*=".mp4"]').attr('href');
    
    if (!finalMp4Link) {
        console.error("VOE: Could not find final MP4 link.");
        return null;
    }

    console.log(`VOE: Final MP4 Link: ${finalMp4Link}`);
    return finalMp4Link;
  }
}

// --- UTILITY FUNCTIONS (copied from original context, type annotations removed) ---

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  } 
  return matrix[a.length][b.length];
}

function similarityScore(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

function filterBySimilarity(input, candidates, threshold) {
  let validMatches = candidates
    .map(candidate => ({
      title: candidate,
      score: similarityScore(normalizeStringBeforeLevenshtein(input), normalizeStringBeforeLevenshtein(candidate)),
    }))
    .filter(item => item.score >= threshold);

  if (validMatches.length > 0) {
    return validMatches.reduce((prev, current) => (prev.score > current.score) ? prev : current).score;
  }
  return null;
}

async function getAniListMangaDetails(query, id = 0) {
  const aniListAPI = 'https://graphql.anilist.co';
  let variables = {};
  let aniListQuery = '';

  if (id == 0) {
    variables = { search: query };
    aniListQuery = getAniListQueryString('search');
  } else {
    variables = { mediaId: id };
    aniListQuery = getAniListQueryString('id');
  }

  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: aniListQuery,
      variables: variables,
    }),
  };
  let responseGraph = await fetch(aniListAPI, options);

  if (!responseGraph.ok) {
    console.warn(`AniList fetch failed: ${responseGraph.statusText}`);
    return { title: [], synonyms: [], year: 0 };
  }

  let data = await responseGraph.json();
  
  if (!data.data || !data.data.Media) {
      return { title: [], synonyms: [], year: 0 };
  }

  let animeYear = data.data.Media.startDate['year'];
  let animeSynonyms = data.data.Media.synonyms;

  const titles = [];
  if (data.data.Media.title.english) titles.push(data.data.Media.title.english);
  if (data.data.Media.title.romaji) titles.push(data.data.Media.title.romaji);

  return {
    title: titles,
    synonyms: animeSynonyms ?? [],
    year: animeYear,
  };
}

function getAniListQueryString(type) {
  let query = `query`;
  switch (type) {
    case 'id':
      query += `($mediaId: Int) { Media(id: $mediaId) {`;
      break;
    case 'search':
      query += `($search: String) { Media(search: $search, format_in: [OVA, ONA, TV, MOVIE, SPECIAL], isAdult: true) {`;
      break;
  }
  query += `id
      title {
        romaji
        english
        native
      }
      startDate {
        day
        month
        year
      }
      meanScore
      synonyms
      updatedAt
      coverImage {
        large
      }
    }
    }`;
  return query;
}

function normalizeStringBeforeLevenshtein(input) {
  return input
    .replace(/Season/gi, '')
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
    // Remove common separators that don't change core title (e.g., 'VS.', ':', '-', etc.)
    .replace(/\s*[:\-\.・]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
