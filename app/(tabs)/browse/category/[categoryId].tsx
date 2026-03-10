import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getCategories } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';

export default function CategoryDetailScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const category = categories.find((c) => c.id === categoryId);
  const categoryName = category?.name ?? categoryId ?? '';
  const categoryColor = category?.color ?? colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={categoryName} showBack backgroundColor={categoryColor} />
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
