import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

interface Video {
  id: string;
  youtubeVideoId?: string;
  [key: string]: unknown;
}

const STORE_NAME = 'library';
const BLOB_KEY = 'videos';

export default async (request: Request, _context: Context) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (request.method === 'GET') {
      const raw = await store.get(BLOB_KEY);
      const videos: Video[] = raw ? JSON.parse(raw) : [];
      return new Response(JSON.stringify(videos), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const video: Video = await request.json();
      if (!video || !video.id) {
        return new Response(JSON.stringify({ error: 'Missing video id' }), { status: 400, headers });
      }

      const raw = await store.get(BLOB_KEY);
      const videos: Video[] = raw ? JSON.parse(raw) : [];

      const duplicate = videos.some(
        (v) => v.id === video.id || (v.youtubeVideoId && v.youtubeVideoId === video.youtubeVideoId)
      );
      if (duplicate) {
        return new Response(JSON.stringify({ message: 'Video already exists' }), { status: 409, headers });
      }

      videos.push(video);
      await store.set(BLOB_KEY, JSON.stringify(videos));
      return new Response(JSON.stringify(video), { status: 201, headers });
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id parameter' }), { status: 400, headers });
      }

      const raw = await store.get(BLOB_KEY);
      const videos: Video[] = raw ? JSON.parse(raw) : [];
      const filtered = videos.filter((v) => v.id !== id);
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
