import type { Video } from '@src/types/video';

const BASE = '/.netlify/functions/library';

export async function fetchLibraryVideos(): Promise<Video[]> {
  const res = await fetch(BASE);
  if (!res.ok) return [];
  return res.json();
}

export async function addLibraryVideo(video: Video): Promise<Video> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(video),
  });
  // Treat 409 (duplicate) as success
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to add video (${res.status})`);
  }
  return video;
}

export async function removeLibraryVideo(id: string): Promise<void> {
  const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to remove video (${res.status})`);
  }
}
