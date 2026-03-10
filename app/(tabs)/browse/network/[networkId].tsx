import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getNetworks } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';

export default function NetworkDetailScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const network = networks.find((n) => n.id === networkId);
  const networkName = network?.name ?? networkId ?? '';
  const networkColor = network?.color ?? colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={networkName} showBack backgroundColor={networkColor} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.empty}>
            Browse channels from the Home screen.
          </Text>
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
  empty: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
