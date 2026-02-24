import type { Context } from '@netlify/functions';

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const ytResponse = await fetch(
      'https://www.youtube.com/youtubei/v1/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
            },
          },
          query,
        }),
      }
    );

    if (!ytResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'YouTube API error' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await ytResponse.json();

    interface SearchResult {
      videoId: string;
      title: string;
      thumbnailUrl: string;
      uploaderName: string;
      duration: number;
      viewCount: string;
    }

    const results: SearchResult[] = [];

    const sections =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents ?? [];

    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents ?? [];
      for (const item of items) {
        const vr = item?.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const titleRuns = vr.title?.runs ?? [];
        const title = titleRuns.map((r: any) => r.text ?? '').join('');

        const channelRuns = vr.ownerText?.runs ?? [];
        const uploaderName = channelRuns
          .map((r: any) => r.text ?? '')
          .join('');

        const durationText: string = vr.lengthText?.simpleText ?? '';
        let duration = 0;
        const parts = durationText.split(':').map(Number);
        if (parts.length === 3)
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) duration = parts[0] * 60 + parts[1];

        const thumbnails = vr.thumbnail?.thumbnails ?? [];
        const thumbnailUrl =
          thumbnails.length > 0
            ? thumbnails[thumbnails.length - 1].url
            : `https://img.youtube.com/vi/${vr.videoId}/mqdefault.jpg`;

        const viewCount: string =
          vr.shortViewCountText?.simpleText ?? '';

        results.push({
          videoId: vr.videoId,
          title: title || 'Untitled',
          thumbnailUrl,
          uploaderName: uploaderName || 'Unknown',
          duration,
          viewCount,
        });

        if (results.length >= 20) break;
      }
      if (results.length >= 20) break;
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
