import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

interface AppConfig {
  channelOrder: string[];
  videoOverrides: Record<string, { channelId: string }>;
  sectionTitleOverrides?: Record<string, string>;
  hiddenSections?: string[];
}

const STORE_NAME = 'config';
const BLOB_KEY = 'app-config';

const DEFAULT_CONFIG: AppConfig = {
  channelOrder: [],
  videoOverrides: {},
};

export default async (request: Request, _context: Context) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const headers = { 'Content-Type': 'application/json' };

  try {
    if (request.method === 'GET') {
      const raw = await store.get(BLOB_KEY);
      const config: AppConfig = raw ? JSON.parse(raw) : DEFAULT_CONFIG;
      return new Response(JSON.stringify(config), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const config: AppConfig = await request.json();
      if (!config || !Array.isArray(config.channelOrder) || typeof config.videoOverrides !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid config format' }), { status: 400, headers });
      }
      await store.set(BLOB_KEY, JSON.stringify(config));
      return new Response(JSON.stringify(config), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers }
    );
  }
};
