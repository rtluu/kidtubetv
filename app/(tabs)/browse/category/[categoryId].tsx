import { StyleSheet, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getCategories, getChannels, getNetworks } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';
import ChannelCard from '@src/components/ChannelCard';

export default function CategoryDetailScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['channels', 'category', categoryId],
    queryFn: () => getChannels({ categoryId }),
    enabled: !!categoryId,
  });

  const category = categories.find((c) => c.id === categoryId);
  const categoryName = category?.name ?? categoryId ?? '';
  const categoryColor = category?.color ?? colors.primary;

  // Build a lookup of network colors for channel accent
  const networkColorMap = networks.reduce<Record<string, string>>((acc, n) => {
    acc[n.id] = n.color;
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={categoryName} showBack backgroundColor={categoryColor} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {channels.length} show{channels.length !== 1 ? 's' : ''}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={categoryColor} size="large" />
          ) : channels.length === 0 ? (
            <Text style={styles.empty}>No shows yet in this category.</Text>
          ) : (
            channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                accentColor={networkColorMap[channel.networkId] || colors.primary}
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
