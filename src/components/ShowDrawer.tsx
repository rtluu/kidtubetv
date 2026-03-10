import { useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius, typography } from '@src/constants/theme';
import { fetchSubscribedChannels } from '@src/services/channelSubscriptions';
import { fetchAppConfig } from '@src/services/config';
import { SubscribedChannel } from '@src/types/video';

interface ShowDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const DRAWER_WIDTH = 300;

export default function ShowDrawer({ visible, onClose }: ShowDrawerProps) {
  const router = useRouter();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const { data: channels = [] } = useQuery({
    queryKey: ['subscribedChannels'],
    queryFn: fetchSubscribedChannels,
    staleTime: 0,
  });

  const { data: appConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  const sortedChannels = (() => {
    const chs = [...channels];
    const channelOrder = appConfig?.channelOrder ?? [];
    if (channelOrder.length > 0) {
      const orderMap = new Map(channelOrder.map((id, i) => [id, i]));
      chs.sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 999 + a.sortOrder;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 999 + b.sortOrder;
        return ai - bi;
      });
    } else {
      chs.sort((a, b) => a.title.localeCompare(b.title));
    }
    return chs;
  })() as SubscribedChannel[];

  useEffect(() => {
    if (visible) {
      // Lock body scroll on web
      if (Platform.OS === 'web') {
        document.body.style.overflow = 'hidden';
      }
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      // Restore body scroll on web
      if (Platform.OS === 'web') {
        document.body.style.overflow = '';
      }
    }
  }, [visible, translateX, backdropOpacity]);

  // Cleanup scroll lock on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  const handleShowPress = useCallback(
    (channel: SubscribedChannel) => {
      onClose();
      router.push(`/browse/channel/${channel.id}`);
    },
    [onClose, router]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX }] }]}
      >
        {/* Drawer header */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Shows</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <FontAwesome name="times" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Show list */}
        <ScrollView style={styles.drawerScroll}>
          {sortedChannels.map((channel) => (
            <Pressable
              key={channel.id}
              style={styles.showItem}
              onPress={() => handleShowPress(channel)}
            >
              <Image
                source={{ uri: channel.thumbnailUrl }}
                style={styles.showThumb}
              />
              <Text style={styles.showTitle}>{channel.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.dark,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  drawerTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 20,
    fontWeight: '600',
    color: colors.crtBlue,
  },
  closeBtn: {
    padding: spacing.sm,
  },
  drawerScroll: {
    flex: 1,
  },
  showItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  showThumb: {
    width: 80,
    height: 45,
    borderRadius: borderRadius.sm,
  },
  showTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    color: '#fff',
    marginLeft: spacing.md,
    flex: 1,
  },
});
