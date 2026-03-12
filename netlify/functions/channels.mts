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
  source?: 'youtube' | 'pbskids';
  pbsShowSlug?: string;
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

function classifyInput(input: string): { type: 'channelId' | 'handle' | 'slug' | 'search' | 'pbskids'; value: string } {
  const trimmed = input.trim();

  // PBS Kids URL: pbskids.org/videos/arthur or pbskids.org/arthur
  const pbsMatch = trimmed.match(/pbskids\.org\/(?:videos\/)?([a-z][a-z0-9-]*)/i);
  if (pbsMatch) {
    return { type: 'pbskids', value: pbsMatch[1].toLowerCase() };
  }

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

function formatShowSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Find the PBS API slug that actually returns episodes.
// Tries: exact slug, progressive prefix truncations, then single-segment-removal
// variants. This handles cases like:
//   "mister-rogers-neighborhood" → "mister-rogers"   (prefix truncation)
//   "clifford-the-big-red-dog"   → "clifford-big-red-dog" (drop "the")
async function normalizePBSSlug(slug: string): Promise<{ slug: string; firstEp: any | null }> {
  const segments = slug.split('-');

  // Build candidate list (deduped, preserving priority order):
  // 1. All prefix truncations from longest to shortest
  const candidates: string[] = [];
  for (let len = segments.length; len >= 1; len--) {
    candidates.push(segments.slice(0, len).join('-'));
  }
  // 2. Single-segment-removal variants (skip first and last — already covered by prefixes)
  for (let i = 1; i < segments.length - 1; i++) {
    const variant = [...segments.slice(0, i), ...segments.slice(i + 1)].join('-');
    if (!candidates.includes(variant)) candidates.push(variant);
  }

  for (const trySlug of candidates) {
    try {
      const res = await fetch(
        `https://producerplayer.services.pbskids.org/show-list/?shows=${encodeURIComponent(trySlug)}&available=public&type=episode&page_size=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items: any[] = data?.items ?? data?.results ?? [];
      if (items.length > 0) return { slug: trySlug, firstEp: items[0] };
    } catch {
      continue;
    }
  }
  return { slug, firstEp: null };
}

async function subscribePBSShow(rawSlug: string): Promise<SubscribedChannel | null> {
  // Normalize: find the PBS API slug that actually returns episodes
  const { slug, firstEp } = await normalizePBSSlug(rawSlug);

  // Require at least one episode to confirm the show exists
  if (!firstEp) return null;

  const title = formatShowSlug(slug);
  const channelId = `pbs-${slug}`;

  // Extract thumbnail from the first episode
  let thumbnailUrl = '';
  try {
    const images = firstEp.images;
    if (images && typeof images === 'object' && !Array.isArray(images)) {
      thumbnailUrl =
        (images as any)['kids-mezzannine-16x9']?.url ??
        (images as any)['kids-mezzanine-16x9']?.url ??
        (images as any)['kids-mezzannine-4x3']?.url ??
        Object.values(images as Record<string, any>)[0]?.url ??
        '';
    }
  } catch {
    // thumbnail stays empty; non-fatal
  }

  return {
    id: channelId,
    youtubeChannelId: channelId,
    handle: slug,
    title,
    thumbnailUrl,
    subscribedAt: Date.now(),
    sortOrder: 0,
    source: 'pbskids',
    pbsShowSlug: slug,
  };
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

      if (classified.type === 'pbskids') {
        // PBS Kids show subscription
        const channel = await subscribePBSShow(classified.value);
        if (!channel) {
          return new Response(
            JSON.stringify({ error: 'Could not find PBS Kids show. Try pasting the show URL from pbskids.org.' }),
            { status: 404, headers }
          );
        }

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
