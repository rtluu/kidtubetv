import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius, typography } from '@src/constants/theme';
import { usePreferencesStore } from '@src/stores/usePreferencesStore';
import LibraryTab from '@src/components/admin/LibraryTab';
import ControlsTab from '@src/components/admin/ControlsTab';

type AdminTab = 'library' | 'controls';

const ADMIN_TABS: { key: AdminTab; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
  { key: 'library', label: 'Library', icon: 'film' },
  { key: 'controls', label: 'Controls', icon: 'clock-o' },
];

// ── PIN Entry Screen ──────────────────────────────────────────
function PinGate({
  parentPin,
  onAuthenticated,
  onSetPin,
}: {
  parentPin: string | null;
  onAuthenticated: () => void;
  onSetPin: (pin: string) => void;
}) {
  const [pinInput, setPinInput] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    if (pinInput.length !== 4) return;

    if (parentPin) {
      if (pinInput === parentPin) {
        onAuthenticated();
      } else {
        setError('Incorrect PIN. Try again.');
        setPinInput('');
      }
      return;
    }

    if (!isConfirming) {
      setFirstPin(pinInput);
      setIsConfirming(true);
      setPinInput('');
      setError(null);
      return;
    }

    if (pinInput === firstPin) {
      onSetPin(pinInput);
      onAuthenticated();
    } else {
      setError('PINs do not match. Start over.');
      setIsConfirming(false);
      setFirstPin('');
      setPinInput('');
    }
  }, [pinInput, parentPin, isConfirming, firstPin, onAuthenticated, onSetPin]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.pinContainer}>
        <FontAwesome name="lock" size={48} color={colors.crtBlue} />
        <Text style={styles.pinTitle}>
          {parentPin ? 'Enter PIN' : 'Set Parent PIN'}
        </Text>
        <Text style={styles.pinSubtitle}>
          {parentPin
            ? 'Enter your 4-digit PIN to access Parent Admin'
            : isConfirming
              ? 'Confirm your 4-digit PIN'
              : 'Create a 4-digit PIN to protect admin settings'}
        </Text>
        <TextInput
          style={styles.pinInput}
          value={pinInput}
          onChangeText={(text) => {
            setPinInput(text.replace(/[^0-9]/g, '').slice(0, 4));
            setError(null);
          }}
          placeholder="----"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={handleSubmit}
        />
        {error && <Text style={styles.pinError}>{error}</Text>}
        <Pressable
          style={[styles.pinButton, pinInput.length !== 4 && styles.pinButtonDisabled]}
          onPress={handleSubmit}
          disabled={pinInput.length !== 4}
        >
          <Text style={styles.pinButtonText}>
            {parentPin ? 'Unlock' : isConfirming ? 'Confirm PIN' : 'Set PIN'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Main Settings Screen ──────────────────────────────────────
export default function SettingsScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('library');

  const parentPin = usePreferencesStore((s) => s.parentPin);
  const setParentPin = usePreferencesStore((s) => s.setParentPin);

  if (!isAuthenticated) {
    return (
      <PinGate
        parentPin={parentPin}
        onAuthenticated={() => setIsAuthenticated(true)}
        onSetPin={setParentPin}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Parent Admin</Text>
          <Pressable
            style={styles.lockButton}
            onPress={() => setIsAuthenticated(false)}
          >
            <FontAwesome name="lock" size={14} color="#fff" />
            <Text style={styles.lockButtonText}>Lock</Text>
          </Pressable>
        </View>
      </View>

      {/* Sub-tab bar */}
      <View style={styles.tabBar}>
        {ADMIN_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <FontAwesome
              name={tab.icon}
              size={14}
              color={activeTab === tab.key ? colors.crtBlue : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'library' && <LibraryTab />}
      {activeTab === 'controls' && <ControlsTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.dark,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.crtBlue,
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
    letterSpacing: 1,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  lockButtonText: {
    color: '#fff',
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    marginLeft: 6,
  },

  // PIN Gate
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  pinTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: typography.subheading.fontSize,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  pinSubtitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  pinInput: {
    width: 160,
    height: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 12,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  pinError: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
    marginBottom: spacing.sm,
  },
  pinButton: {
    backgroundColor: colors.crtBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  pinButtonDisabled: {
    opacity: 0.4,
  },
  pinButtonText: {
    color: '#fff',
    fontFamily: typography.button.fontFamily,
    fontSize: 15,
    fontWeight: '600',
  },

  // Sub-tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(0,212,255,0.15)',
  },
  tabLabel: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  tabLabelActive: {
    color: colors.crtBlue,
    fontWeight: '600',
  },
});
