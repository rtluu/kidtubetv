import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getChannels, getVideos, getNetworks } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';
import VideoCard from '@src/components/VideoCard';

export default function ChannelDetailScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => getChannels(),
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', 'channel', channelId],
    queryFn: () => getVideos({ channelId }),
    enabled: !!channelId,
  });

  const channel = channels.find((c) => c.id === channelId);
  const network = networks.find((n) => n.id === channel?.networkId);
  const accentColor = network?.color ?? colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={channel?.title ?? channelId ?? ''}
        showBack
        backgroundColor={accentColor}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {channel?.description ? (
            <Text style={styles.description}>{channel.description}</Text>
          ) : null}
          <Text style={styles.subtitle}>
            {videos.length} video{videos.length !== 1 ? 's' : ''}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={accentColor} size="large" />
          ) : videos.length === 0 ? (
            <Text style={styles.empty}>No videos yet for this channel.</Text>
          ) : (
            videos.map((video) => <VideoCard key={video.id} video={video} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
    maxWidth: 700,
    width: '100%',
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  empty: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
