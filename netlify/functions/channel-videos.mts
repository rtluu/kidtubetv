import type { Context } from '@netlify/functions';

interface Video {
  id: string;
  title: string;
  description: string;
  source: 'youtube';
  youtubeVideoId: string;
  thumbnailUrl: string;
  duration: number;
  channelId: string;
  networkId: string;
  categoryIds: string[];
  tags: string[];
  ageRange: { min: number; max: number };
  viewCount?: string;
  sortOrder: number;
  isActive: boolean;
  isFreebie: boolean;
}

const INNERTUBE_CONTEXT = {
  context: {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20240101.00.00',
    },
  },
};

// InnerTube "Videos" tab param
const VIDEOS_TAB_PARAM = 'EgZ2aWRlb3PyBgQKAjoA';

function parseDuration(text: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const channelId = url.searchParams.get('channelId');
  const headers = { 'Content-Type': 'application/json' };

  if (!channelId) {
    return new Response(JSON.stringify({ error: 'Missing channelId parameter' }), {
      status: 400,
      headers,
    });
  }

  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...INNERTUBE_CONTEXT,
        browseId: channelId,
        params: VIDEOS_TAB_PARAM,
      }),
    });

    if (!res.ok) {
      return new Response(JSON.stringify([]), { status: 200, headers });
    }

    const data = await res.json();

    const videos: Video[] = [];

    // Navigate to richGridRenderer contents
    const tabs: any[] = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
    let richItems: any[] = [];

    for (const tab of tabs) {
      const content = tab?.tabRenderer?.content;
      if (!content) continue;
      const items = content?.richGridRenderer?.contents;
      if (items) {
        richItems = items;
        break;
      }
    }

    for (let i = 0; i < richItems.length; i++) {
      const item = richItems[i];
      const vr = item?.richItemRenderer?.content?.videoRenderer;
      if (!vr || !vr.videoId) continue;

      const titleRuns: any[] = vr.title?.runs ?? [];
      const title: string = titleRuns.map((r: any) => r.text ?? '').join('') || 'Untitled';

      const thumbnails: any[] = vr.thumbnail?.thumbnails ?? [];
      const thumbnailUrl: string =
        thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : `https://img.youtube.com/vi/${vr.videoId}/mqdefault.jpg`;

      const durationText: string = vr.lengthText?.simpleText ?? '';
      const duration = parseDuration(durationText);

      const viewCount: string = vr.shortViewCountText?.simpleText ?? '';

      videos.push({
        id: `yt-${vr.videoId}`,
        title,
        description: '',
        source: 'youtube',
        youtubeVideoId: vr.videoId,
        thumbnailUrl,
        duration,
        channelId,
        networkId: 'youtube',
        categoryIds: [],
        tags: [],
        ageRange: { min: 2, max: 12 },
        viewCount: viewCount || undefined,
        sortOrder: i,
        isActive: true,
        isFreebie: true,
      });

      if (videos.length >= 20) break;
    }

    return new Response(JSON.stringify(videos), { status: 200, headers });
  } catch {
    // Return empty gracefully if structure changes
    return new Response(JSON.stringify([]), { status: 200, headers });
  }
};
