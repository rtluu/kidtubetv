import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Network } from '@src/types/video';
import { spacing, borderRadius, shadows, typography } from '@src/constants/theme';

interface NetworkCardProps {
  network: Network;
  compact?: boolean;
}

export default function NetworkCard({ network, compact = false }: NetworkCardProps) {
  return (
    <Link href={`/browse/network/${network.id}` as any} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: network.color, opacity: pressed ? 0.85 : 1 },
          compact && styles.compact,
        ]}
      >
        <Text style={[styles.shortName, compact && styles.compactShortName]}>
          {network.shortName}
        </Text>
        {!compact && <Text style={styles.name}>{network.name}</Text>}
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
  compact: {
    minHeight: 70,
    width: 120,
    marginRight: spacing.sm,
    padding: spacing.sm,
  },
  shortName: {
    color: '#fff',
    fontFamily: typography.heading.fontFamily,
    fontSize: 14,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  compactShortName: {
    fontSize: 11,
  },
  name: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
