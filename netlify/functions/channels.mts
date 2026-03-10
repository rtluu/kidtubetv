import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

interface SubscribedChannel {
  id: string;
  youtubeChannelId: string;
  handle: string;
  title: string;
  thumbnailUrl: string;
  subscribedAt: number;
  sortOrder: number;
}

interface ChannelSearchResult {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  handle: string;
  subscriberCount: string;
}

const STORE_NAME = 'channels';
const BLOB_KEY = 'subscribed';

const INNERTUBE_CONTEXT = {
  context: {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20240101.00.00',
    },
  },
};

function classifyInput(input: string): { type: 'channelId' | 'handle' | 'slug' | 'search'; value: string } {
  const trimmed = input.trim();

  // UCxxx style (channel ID)
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: 'channelId', value: trimmed };
  }

  // URL containing /channel/UCxxx
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (channelMatch) {
    return { type: 'channelId', value: channelMatch[1] };
  }

  // URL containing @handle or bare @handle
  const atUrlMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  if (atUrlMatch) {
    return { type: 'handle', value: `@${atUrlMatch[1]}` };
  }
  if (trimmed.startsWith('@')) {
    return { type: 'handle', value: trimmed };
  }

  // /c/ or /user/ slugs
  const cMatch = trimmed.match(/youtube\.com\/c\/([\w.-]+)/);
  if (cMatch) {
    return { type: 'slug', value: cMatch[1] };
  }
  const userMatch = trimmed.match(/youtube\.com\/user\/([\w.-]+)/);
  if (userMatch) {
    return { type: 'slug', value: userMatch[1] };
  }

  return { type: 'search', value: trimmed };
}

async function browseChannel(browseId: string): Promise<SubscribedChannel | null> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...INNERTUBE_CONTEXT, browseId }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const meta = data?.metadata?.channelMetadataRenderer;
  if (!meta) return null;

  const channelId: string = meta.externalId ?? browseId;
  const title: string = meta.title ?? 'Unknown Channel';

  const avatarThumbails: any[] = meta.avatar?.thumbnails ?? [];
  const thumbnailUrl: string =
    avatarThumbails.length > 0
      ? avatarThumbails[avatarThumbails.length - 1].url
      : '';

  const handleRuns: any[] =
    data?.header?.c4TabbedHeaderRenderer?.channelHandleText?.runs ?? [];
  const handle: string =
    handleRuns.length > 0 ? handleRuns[0].text ?? '' : '';

  return {
    id: channelId,
    youtubeChannelId: channelId,
    handle,
    title,
    thumbnailUrl,
    subscribedAt: Date.now(),
    sortOrder: 0,
  };
}

async function searchChannels(query: string): Promise<ChannelSearchResult[]> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...INNERTUBE_CONTEXT,
      query,
      params: 'EgIQAg==', // channels filter
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const results: ChannelSearchResult[] = [];

  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents ?? [];

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents ?? [];
    for (const item of items) {
      const cr = item?.channelRenderer;
      if (!cr || !cr.channelId) continue;

      const title: string = cr.title?.simpleText ?? 'Unknown';
      const thumbnails: any[] = cr.thumbnail?.thumbnails ?? [];
      const thumbnailUrl: string =
        thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

      const handleText: string =
        cr.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? '';
      const handle = handleText.startsWith('/') ? handleText.slice(1) : handleText;

      const subscriberCount: string =
        cr.subscriberCountText?.simpleText ?? '';

      results.push({
        channelId: cr.channelId,
        title,
        thumbnailUrl,
        handle,
        subscriberCount,
      });

      if (results.length >= 8) break;
    }
    if (results.length >= 8) break;
  }

  return results;
}

export default async (request: Request, _context: Context) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (request.method === 'GET') {
      const store = getStore({ name: STORE_NAME, consistency: 'strong' });
      const raw = await store.get(BLOB_KEY);
      const channels: SubscribedChannel[] = raw ? JSON.parse(raw) : [];
      return new Response(JSON.stringify(channels), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const input: string = body?.input ?? '';

      if (!input.trim()) {
        return new Response(JSON.stringify({ error: 'Missing input' }), { status: 400, headers });
      }

      const classified = classifyInput(input);

      if (classified.type === 'search') {
        // Search path: no blob access needed
        const results = await searchChannels(classified.value);
        return new Response(JSON.stringify({ results }), { status: 200, headers });
      }

      // Resolve channel via InnerTube browse
      const channel = await browseChannel(classified.value);

      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found. Try using the channel URL or @handle.' }), { status: 404, headers });
      }

      // Load existing subscriptions and add/update
      const store = getStore({ name: STORE_NAME, consistency: 'strong' });
      const raw = await store.get(BLOB_KEY);
      const channels: SubscribedChannel[] = raw ? JSON.parse(raw) : [];

      const existing = channels.find((c) => c.id === channel.id);
      if (existing) {
        return new Response(JSON.stringify({ channel: existing }), { status: 200, headers });
      }

      channel.sortOrder = channels.length;
      channels.push(channel);
      await store.set(BLOB_KEY, JSON.stringify(channels));

      return new Response(JSON.stringify({ channel }), { status: 201, headers });
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id parameter' }), { status: 400, headers });
      }

      const store = getStore({ name: STORE_NAME, consistency: 'strong' });
      const raw = await store.get(BLOB_KEY);
      const channels: SubscribedChannel[] = raw ? JSON.parse(raw) : [];
      const filtered = channels.filter((c) => c.id !== id);
      await store.set(BLOB_KEY, JSON.stringify(filtered));

      return new Response(JSON.stringify({ deleted: id }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers }
    );
  }
};
