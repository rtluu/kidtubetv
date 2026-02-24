import React from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Video } from '@src/types/video';
import { formatDuration } from '@src/utils/format';
import { colors, spacing, borderRadius, shadows, typography } from '@src/constants/theme';

interface VideoCardProps {
  video: Video;
  onPress?: () => void;
}

export default function VideoCard({ video, onPress }: VideoCardProps) {
  const cardContent = (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={styles.description} numberOfLines={1}>
          {video.description}
        </Text>
      </View>
    </Pressable>
  );

  if (onPress) {
    return cardContent;
  }

  return (
    <Link href={`/player/${video.id}`} asChild>
      {cardContent}
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
  thumbnailContainer: {
    width: 160,
    height: 90,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.dark,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  info: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },
});
