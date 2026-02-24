import type { AppConfig } from '@src/types/video';

const BASE = '/.netlify/functions/config';

const DEFAULT_CONFIG: AppConfig = {
  channelOrder: [],
  videoOverrides: {},
};

export async function fetchAppConfig(): Promise<AppConfig> {
  const res = await fetch(BASE);
  if (!res.ok) return DEFAULT_CONFIG;
  return res.json();
}

export async function saveAppConfig(config: AppConfig): Promise<AppConfig> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`Failed to save config (${res.status})`);
  }
  return res.json();
}
