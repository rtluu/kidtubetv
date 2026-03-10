import type { Context } from '@netlify/functions';

interface Video {
  id: string;
  title: string;
  description: string;
  source: 'pbskids';
  pbsPartnerToken: string;
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

function getBestImage(images: unknown): string {
  if (!images) return '';
  if (Array.isArray(images)) {
    const preferred = (images as any[]).find(
      (img) => img.profile === 'kids-mezzanine-16x9' || img.profile === 'mezzanine'
    );
    const img = preferred ?? (images as any[])[0];
    // Media Manager uses 'image' field, content services uses 'url'
    return img?.image ?? img?.url ?? '';
  }
  if (typeof images === 'object' && images !== null) {
    const obj = images as Record<string, string>;
    return obj['kids-mezzanine-16x9'] ?? obj['mezzanine'] ?? '';
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
    const results: any[] = data?.results ?? [];

    const videos: Video[] = [];

    for (let i = 0; i < results.length; i++) {
      const ep = results[i];
      if (!ep) continue;

      const playerCode: string = ep.player_code ?? '';
      const token = extractPartnerToken(playerCode);
      if (!token) continue; // skip episodes with no embeddable player

      const title: string =
        ep.title ?? ep.title_sortable ?? ep.label ?? 'Untitled';
      const images = ep.images ?? ep.image ?? null;
      const thumbnailUrl = getBestImage(images);
      const duration: number =
        typeof ep.duration === 'number' ? ep.duration : 0;
      const description: string =
        ep.description_short ?? ep.description_long ?? ep.description ?? '';

      // Use tp_media_object_id if available (stable numeric ID), else fallback to id
      const epId: string = String(
        ep.tp_media_object_id ?? ep.id ?? `${showSlug}-${i}`
      );

      videos.push({
        id: `pbs-${epId}`,
        title,
        description,
        source: 'pbskids',
        pbsPartnerToken: token,
        thumbnailUrl,
        duration,
        channelId,
        networkId: 'pbskids',
        categoryIds: [],
        tags: [],
        ageRange: { min: 2, max: 10 },
        sortOrder: i,
        isActive: true,
        isFreebie: true,
      });

      if (videos.length >= 20) break;
    }

    return new Response(JSON.stringify(videos), { status: 200, headers });
  } catch {
    // Return empty gracefully if API structure changes
    return new Response(JSON.stringify([]), { status: 200, headers });
  }
};
