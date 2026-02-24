export interface ParsedYouTubeUrl {
  videoId: string | null;
  playlistId: string | null;
}

export function parseYouTubeUrl(url: string): ParsedYouTubeUrl {
  const result: ParsedYouTubeUrl = { videoId: null, playlistId: null };

  try {
    const trimmed = url.trim();

    // Handle youtu.be short URLs
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) {
      result.videoId = shortMatch[1];
    }

    const urlObj = new URL(trimmed);
    const hostname = urlObj.hostname.replace('www.', '').replace('m.', '');

    if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
      // /watch?v=ID
      const v = urlObj.searchParams.get('v');
      if (v && v.length === 11) result.videoId = v;

      // /embed/ID
      const embedMatch = urlObj.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) result.videoId = embedMatch[1];

      // /v/ID
      const vMatch = urlObj.pathname.match(/\/v\/([a-zA-Z0-9_-]{11})/);
      if (vMatch) result.videoId = vMatch[1];

      // /shorts/ID
      const shortsMatch = urlObj.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) result.videoId = shortsMatch[1];

      // /live/ID
      const liveMatch = urlObj.pathname.match(/\/live\/([a-zA-Z0-9_-]{11})/);
      if (liveMatch) result.videoId = liveMatch[1];

      // Playlist
      const list = urlObj.searchParams.get('list');
      if (list) result.playlistId = list;
    }

    if (hostname === 'youtu.be') {
      const list = urlObj.searchParams.get('list');
      if (list) result.playlistId = list;
    }
  } catch {
    // Invalid URL
  }

  return result;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  uploaderName: string;
  duration: number;
  viewCount: string;
}

export async function searchYouTube(
  query: string
): Promise<YouTubeSearchResult[]> {
  let response: Response;
  try {
    response = await fetch(
      `/.netlify/functions/youtube-search?q=${encodeURIComponent(query)}`
    );
  } catch {
    throw new Error('Network error — make sure the app is running with netlify dev.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('YouTube search not available. Start the app with "netlify dev" (not "expo start") to enable search.');
    }
    if (response.status === 502) {
      throw new Error('YouTube search temporarily unavailable. Try again later.');
    }
    throw new Error(`Search failed (${response.status}). Make sure the app is running with "netlify dev".`);
  }

  const results: YouTubeSearchResult[] = await response.json();
  return results;
}

export interface YouTubeVideoInfo {
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export async function fetchYouTubeVideoInfo(
  videoId: string
): Promise<YouTubeVideoInfo | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      title: data.title ?? 'Untitled Video',
      authorName: data.author_name ?? 'Unknown',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch {
    return null;
  }
}
