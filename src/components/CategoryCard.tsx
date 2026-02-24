import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Category } from '@src/types/video';
import { spacing, borderRadius, shadows, typography } from '@src/constants/theme';

const categoryEmojis: Record<string, string> = {
  cartoons: '\uD83C\uDFA8',
  'live-action': '\uD83C\uDFAC',
  movies: '\uD83C\uDFAC',
  educational: '\uD83D\uDCDA',
  music: '\uD83C\uDFB5',
};

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  const emoji = categoryEmojis[category.id] || '\uD83D\uDCFA';

  return (
    <Link href={`/browse/category/${category.id}` as any} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: category.color, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.name}>{category.name}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    ...shadows.card,
  },
  emoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  name: {
    color: '#fff',
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
