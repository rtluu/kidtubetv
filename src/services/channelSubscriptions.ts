import { SubscribedChannel, ChannelSearchResult, Video } from '@src/types/video';

const BASE_URL = '/.netlify/functions';

export async function fetchSubscribedChannels(): Promise<SubscribedChannel[]> {
  const res = await fetch(`${BASE_URL}/channels`);
  if (!res.ok) throw new Error(`Failed to fetch subscribed channels: ${res.status}`);
  return res.json();
}

export type ResolveChannelResult =
  | { type: 'subscribed'; channel: SubscribedChannel }
  | { type: 'results'; results: ChannelSearchResult[] };

export async function resolveChannel(input: string): Promise<ResolveChannelResult> {
  const res = await fetch(`${BASE_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to resolve channel: ${res.status}`);
  }
  const data = await res.json();
  if (data.results) {
    return { type: 'results', results: data.results };
  }
  return { type: 'subscribed', channel: data.channel };
}

export async function subscribeToChannel(youtubeChannelId: string): Promise<SubscribedChannel> {
  const res = await fetch(`${BASE_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: youtubeChannelId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to subscribe: ${res.status}`);
  }
  const data = await res.json();
  return data.channel;
}

export async function unsubscribeFromChannel(channelId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/channels?id=${encodeURIComponent(channelId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Failed to unsubscribe: ${res.status}`);
  }
}

export async function fetchChannelVideos(channelId: string): Promise<Video[]> {
  const res = await fetch(
    `${BASE_URL}/channel-videos?channelId=${encodeURIComponent(channelId)}`
  );
  if (!res.ok) return [];
  return res.json();
}
