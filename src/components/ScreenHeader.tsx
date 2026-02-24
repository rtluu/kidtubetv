import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, typography } from '@src/constants/theme';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  backgroundColor?: string;
}

export default function ScreenHeader({
  title,
  showBack = false,
  backgroundColor = colors.dark,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {showBack && (
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={18} color="#fff" />
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  title: {
    color: '#fff',
    fontFamily: typography.subheading.fontFamily,
    fontSize: typography.subheading.fontSize,
    flex: 1,
  },
});
