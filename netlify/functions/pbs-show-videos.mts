import type { Context } from '@netlify/functions';

interface Video {
  id: string;
  title: string;
  description: string;
  source: 'pbskids';
  pbsPartnerToken: string;
  directUrl: string;
  thumbnailUrl: string;
  duration: number;
  channelId: string;
  networkId: string;
  categoryIds: string[];
  tags: string[];
  ageRange: { min: number; max: number };
  sortOrder: number;
  isActive: boolean;
  isFreebie: boolean;
}

const PRODUCER_API = 'https://producerplayer.services.pbskids.org';

function extractPartnerToken(playerCode: string): string {
  if (!playerCode) return '';
  const match = /partnerplayer\/([^/?'"]+)/.exec(playerCode);
  return match?.[1] ?? '';
}

function findHLSUrl(videos: unknown): string {
  if (!Array.isArray(videos) || videos.length === 0) return '';
  const arr = videos as any[];
  // Prefer 720p HLS, then any HLS, then 720p MP4, then any MP4
  return (
    arr.find((v) => v.format === 'hls' && v.bitrate === '720p')?.url ??
    arr.find((v) => v.format === 'hls')?.url ??
    arr.find((v) => v.format === 'mp4' && v.bitrate === '720p')?.url ??
    arr.find((v) => v.format === 'mp4')?.url ??
    ''
  );
}

async function resolveURSUrl(ursUrl: string): Promise<string> {
  if (!ursUrl) return '';
  try {
    const res = await fetch(ursUrl, { method: 'HEAD', redirect: 'follow' });
    return res.url || ursUrl;
  } catch {
    return ursUrl;
  }
}

function getBestImage(images: unknown): string {
  if (!images) return '';
  // PBS API returns images as an object keyed by profile name
  // Note: PBS uses 'mezzannine' (double-n) in their key names
  if (typeof images === 'object' && !Array.isArray(images)) {
    const obj = images as Record<string, { url?: string }>;
    return (
      obj['kids-mezzannine-16x9']?.url ??
      obj['kids-mezzanine-16x9']?.url ??
      obj['kids-mezzannine-4x3']?.url ??
      obj['kids-mezzanine-4x3']?.url ??
      Object.values(obj)[0]?.url ??
      ''
    );
  }
  // Fallback: array format
  if (Array.isArray(images)) {
    const arr = images as any[];
    const preferred = arr.find(
      (img) =>
        img.profile?.includes('mezzanine') || img.profile?.includes('mezzannine')
    );
    const img = preferred ?? arr[0];
    return img?.url ?? img?.image ?? '';
  }
  return '';
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const showSlug = url.searchParams.get('showSlug');
  const channelId = url.searchParams.get('channelId') ?? `pbs-${showSlug}`;
  const headers = { 'Content-Type': 'application/json' };

  if (!showSlug) {
    return new Response(JSON.stringify({ error: 'Missing showSlug parameter' }), {
      status: 400,
      headers,
    });
  }

  try {
    const apiUrl = `${PRODUCER_API}/show-list/?shows=${encodeURIComponent(showSlug)}&available=public&type=episode&page_size=20`;
    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify([]), { status: 200, headers });
    }

    const data = await res.json();
    // PBS producerplayer API uses 'items', not 'results'
    const results: any[] = data?.items ?? data?.results ?? [];

    // First pass: collect raw episode data (up to 20)
    const rawItems: { ep: any; ursUrl: string; token: string }[] = [];
    for (let i = 0; i < results.length; i++) {
      const ep = results[i];
      if (!ep) continue;

      const ursUrl = findHLSUrl(ep.videos);
      const token = extractPartnerToken(ep.player_code ?? '');

      // Skip episodes with no playback method
      if (!ursUrl && !token) continue;

      rawItems.push({ ep, ursUrl, token });
      if (rawItems.length >= 20) break;
    }

    // Resolve all URS redirect URLs in parallel (server-side CORS bypass)
    const resolvedUrls = await Promise.all(
      rawItems.map((item) => resolveURSUrl(item.ursUrl))
    );

    // Second pass: build Video objects
    const videos: Video[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const { ep, token } = rawItems[i];
      const directUrl = resolvedUrls[i];

      // Skip if we have neither a direct stream nor a fallback token
      if (!directUrl && !token) continue;

      const title: string =
        ep.title ?? ep.title_sortable ?? ep.label ?? 'Untitled';
      const images = ep.images ?? ep.image ?? null;
      const thumbnailUrl = getBestImage(images);
      const duration: number =
        typeof ep.duration === 'number' ? ep.duration : 0;
      const description: string =
        ep.description_short ?? ep.description_long ?? ep.description ?? '';

      // Use guid (stable UUID) as the primary episode identifier
      const epId: string = String(ep.guid ?? ep.id ?? `${showSlug}-${i}`);

      videos.push({
        id: `pbs-${epId}`,
        title,
        description,
        source: 'pbskids',
        pbsPartnerToken: token,
        directUrl,
        thumbnailUrl,
        duration,
        channelId,
        networkId: 'pbskids',
        categoryIds: [],
        tags: [],
        ageRange: { min: 2, max: 10 },
        sortOrder: videos.length,
        isActive: true,
        isFreebie: true,
      });
    }

    return new Response(JSON.stringify(videos), { status: 200, headers });
  } catch {
    // Return empty gracefully if API structure changes
    return new Response(JSON.stringify([]), { status: 200, headers });
  }
};
