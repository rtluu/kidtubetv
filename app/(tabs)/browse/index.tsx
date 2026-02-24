import { StyleSheet, ScrollView, View, Text, ActivityIndicator, useWindowDimensions, DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getNetworks, getCategories } from '@src/services/content';
import ScreenHeader from '@src/components/ScreenHeader';
import NetworkCard from '@src/components/NetworkCard';
import CategoryCard from '@src/components/CategoryCard';

export default function BrowseScreen() {
  const { width } = useWindowDimensions();
  const gridColumns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gridItemWidth = `${100 / gridColumns}%` as DimensionValue;

  const { data: networks = [], isLoading: loadingNetworks } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Browse" />
      <ScrollView style={styles.scrollView}>
        {/* Networks grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Networks</Text>
          {loadingNetworks ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <View style={styles.grid}>
              {networks.map((network) => (
                <View key={network.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                  <NetworkCard network={network} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Categories grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {loadingCategories ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <View style={styles.grid}>
              {categories.map((category) => (
                <View key={category.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                  <CategoryCard category={category} />
                </View>
              ))}
            </View>
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
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: typography.subheading.fontSize,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  gridItem: {
    padding: spacing.xs,
  },
});
