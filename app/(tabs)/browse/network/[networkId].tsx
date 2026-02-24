import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getNetworks, getChannels } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';
import ChannelCard from '@src/components/ChannelCard';

export default function NetworkDetailScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['channels', 'network', networkId],
    queryFn: () => getChannels({ networkId }),
    enabled: !!networkId,
  });

  const network = networks.find((n) => n.id === networkId);
  const networkName = network?.name ?? networkId ?? '';
  const networkColor = network?.color ?? colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={networkName} showBack backgroundColor={networkColor} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {channels.length} show{channels.length !== 1 ? 's' : ''}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={networkColor} size="large" />
          ) : channels.length === 0 ? (
            <Text style={styles.empty}>No shows yet for this network.</Text>
          ) : (
            channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                accentColor={networkColor}
              />
            ))
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
  subtitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
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
