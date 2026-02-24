import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Channel } from '@src/types/video';
import { colors, spacing, borderRadius, shadows, typography } from '@src/constants/theme';

interface ChannelCardProps {
  channel: Channel;
  accentColor?: string;
}

export default function ChannelCard({ channel, accentColor = colors.primary }: ChannelCardProps) {
  return (
    <Link href={`/browse/channel/${channel.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <View style={styles.content}>
          <Text style={styles.title}>{channel.title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {channel.description}
          </Text>
          <Text style={styles.meta}>
            {channel.videoCount} video{channel.videoCount !== 1 ? 's' : ''}
            {'  \u2022  '}
            Ages {channel.ageRange.min}\u2013{channel.ageRange.max}
            {channel.isFreebie ? '  \u2022  Free' : ''}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.card,
  },
  accent: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  meta: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },
});
