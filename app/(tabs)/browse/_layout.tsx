import { Stack } from 'expo-router';

export default function BrowseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="network/[networkId]" />
      <Stack.Screen name="category/[categoryId]" />
      <Stack.Screen name="channel/[channelId]" />
    </Stack>
  );
}
