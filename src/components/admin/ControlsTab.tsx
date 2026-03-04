import { useMemo } from 'react';
import { StyleSheet, ScrollView, View, Text, Pressable, Switch } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, borderRadius, typography, shadows } from '@src/constants/theme';
import { useParentStore } from '@src/stores/useParentStore';
import { useResponsive } from '@src/hooks/useResponsive';
import { GateFrequency } from '@src/types/learningGate';

const TIME_LIMIT_OPTIONS: { label: string; value: number | null }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
  { label: 'No limit', value: null },
];

const BREAK_REMINDER_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

const BEDTIME_OPTIONS = [
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '6:30 PM', hour: 18, minute: 30 },
  { label: '7:00 PM', hour: 19, minute: 0 },
  { label: '7:30 PM', hour: 19, minute: 30 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '8:30 PM', hour: 20, minute: 30 },
  { label: '9:00 PM', hour: 21, minute: 0 },
  { label: '9:30 PM', hour: 21, minute: 30 },
];

export default function ControlsTab() {
  const { fontScale, spacingScale } = useResponsive();
  const scaled = useMemo(() => ({
    sectionTitleFont: Math.round(16 * fontScale),
    controlTitleFont: Math.round(15 * fontScale),
    descFont: Math.round(12 * fontScale),
    chipFont: Math.round(13 * fontScale),
    chipPadH: Math.round(14 * spacingScale),
    chipPadV: Math.round(8 * spacingScale),
    iconSize: Math.round(18 * fontScale),
  }), [fontScale, spacingScale]);

  const dailyTimeLimitMinutes = useParentStore((s) => s.dailyTimeLimitMinutes);
  const setDailyTimeLimit = useParentStore((s) => s.setDailyTimeLimit);
  const bedtimeEnabled = useParentStore((s) => s.bedtimeEnabled);
  const bedtimeHour = useParentStore((s) => s.bedtimeHour);
  const bedtimeMinute = useParentStore((s) => s.bedtimeMinute);
  const setBedtime = useParentStore((s) => s.setBedtime);
  const toggleBedtime = useParentStore((s) => s.toggleBedtime);
  const breakReminderEnabled = useParentStore((s) => s.breakReminderEnabled);
  const breakReminderMinutes = useParentStore((s) => s.breakReminderMinutes);
  const setBreakReminder = useParentStore((s) => s.setBreakReminder);
  const toggleBreakReminder = useParentStore((s) => s.toggleBreakReminder);
  const autoPlayEnabled = useParentStore((s) => s.autoPlayEnabled);
  const toggleAutoPlay = useParentStore((s) => s.toggleAutoPlay);
  const learningGateEnabled = useParentStore((s) => s.learningGateEnabled);
  const setLearningGateEnabled = useParentStore((s) => s.setLearningGateEnabled);
  const childAge = useParentStore((s) => s.childAge);
  const setChildAge = useParentStore((s) => s.setChildAge);
  const gateFrequency = useParentStore((s) => s.gateFrequency);
  const setGateFrequency = useParentStore((s) => s.setGateFrequency);
  const videosPerGate = useParentStore((s) => s.videosPerGate);
  const setVideosPerGate = useParentStore((s) => s.setVideosPerGate);

  const bedtimeLabel =
    BEDTIME_OPTIONS.find(
      (b) => b.hour === bedtimeHour && b.minute === bedtimeMinute
    )?.label ??
    `${bedtimeHour > 12 ? bedtimeHour - 12 : bedtimeHour}:${String(bedtimeMinute).padStart(2, '0')} ${bedtimeHour >= 12 ? 'PM' : 'AM'}`;

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
      {/* Time Controls */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="clock-o" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.sectionTitleFont }]}>Time Controls</Text>
        </View>

        {/* Daily Time Limit */}
        <View style={styles.controlRow}>
          <View style={styles.controlLabel}>
            <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Daily Time Limit</Text>
            <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
              {dailyTimeLimitMinutes
                ? `${dailyTimeLimitMinutes} minutes per day`
                : 'No limit set'}
            </Text>
          </View>
        </View>
        <View style={styles.optionGrid}>
          {TIME_LIMIT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              style={[
                styles.optionChip,
                { paddingHorizontal: scaled.chipPadH, paddingVertical: scaled.chipPadV },
                dailyTimeLimitMinutes === opt.value && styles.optionChipActive,
              ]}
              onPress={() => setDailyTimeLimit(opt.value)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  { fontSize: scaled.chipFont },
                  dailyTimeLimitMinutes === opt.value && styles.optionChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Bedtime */}
        <View style={styles.controlRow}>
          <View style={styles.controlLabel}>
            <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Bedtime</Text>
            <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
              {bedtimeEnabled
                ? `Screen time stops at ${bedtimeLabel}`
                : 'Disabled'}
            </Text>
          </View>
          <Switch
            value={bedtimeEnabled}
            onValueChange={toggleBedtime}
            trackColor={{ false: colors.border, true: colors.crtBlue }}
            thumbColor="#fff"
          />
        </View>
        {bedtimeEnabled && (
          <View style={styles.optionGrid}>
            {BEDTIME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={[
                  styles.optionChip,
                  { paddingHorizontal: scaled.chipPadH, paddingVertical: scaled.chipPadV },
                  bedtimeHour === opt.hour &&
                    bedtimeMinute === opt.minute &&
                    styles.optionChipActive,
                ]}
                onPress={() => setBedtime(opt.hour, opt.minute)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { fontSize: scaled.chipFont },
                    bedtimeHour === opt.hour &&
                      bedtimeMinute === opt.minute &&
                      styles.optionChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Break Reminders */}
        <View style={styles.controlRow}>
          <View style={styles.controlLabel}>
            <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Break Reminders</Text>
            <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
              {breakReminderEnabled
                ? `Remind every ${breakReminderMinutes} minutes`
                : 'Disabled'}
            </Text>
          </View>
          <Switch
            value={breakReminderEnabled}
            onValueChange={toggleBreakReminder}
            trackColor={{ false: colors.border, true: colors.crtBlue }}
            thumbColor="#fff"
          />
        </View>
        {breakReminderEnabled && (
          <View style={styles.optionGrid}>
            {BREAK_REMINDER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={[
                  styles.optionChip,
                  { paddingHorizontal: scaled.chipPadH, paddingVertical: scaled.chipPadV },
                  breakReminderMinutes === opt.value && styles.optionChipActive,
                ]}
                onPress={() => setBreakReminder(opt.value)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { fontSize: scaled.chipFont },
                    breakReminderMinutes === opt.value &&
                      styles.optionChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Learning Gate */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="graduation-cap" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.sectionTitleFont }]}>Learning Gate</Text>
        </View>

        {/* Master toggle */}
        <View style={styles.controlRow}>
          <View style={styles.controlLabel}>
            <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Learning Gate</Text>
            <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
              {learningGateEnabled
                ? 'Kids answer a question before watching'
                : 'Videos play without any challenge'}
            </Text>
          </View>
          <Switch
            value={learningGateEnabled}
            onValueChange={setLearningGateEnabled}
            trackColor={{ false: colors.border, true: colors.crtBlue }}
            thumbColor="#fff"
          />
        </View>

        {learningGateEnabled && (
          <>
            {/* Child Age stepper */}
            <View style={styles.controlRow}>
              <View style={styles.controlLabel}>
                <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Child's Age</Text>
                <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
                  {childAge <= 6 ? 'Counting, colors & shapes' : 'Math, spelling & knowledge'}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, childAge <= 3 && styles.stepperButtonDisabled]}
                  onPress={() => setChildAge(Math.max(3, childAge - 1))}
                  disabled={childAge <= 3}
                >
                  <Text style={[styles.stepperButtonText, childAge <= 3 && styles.stepperButtonTextDisabled]}>−</Text>
                </Pressable>
                <Text style={[styles.stepperValue, { fontSize: scaled.controlTitleFont }]}>
                  Age {childAge}
                </Text>
                <Pressable
                  style={[styles.stepperButton, childAge >= 12 && styles.stepperButtonDisabled]}
                  onPress={() => setChildAge(Math.min(12, childAge + 1))}
                  disabled={childAge >= 12}
                >
                  <Text style={[styles.stepperButtonText, childAge >= 12 && styles.stepperButtonTextDisabled]}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Frequency selector */}
            <View style={styles.controlRow}>
              <View style={styles.controlLabel}>
                <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Frequency</Text>
                <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
                  How often to show the challenge
                </Text>
              </View>
            </View>
            <View style={styles.optionGrid}>
              {([
                { label: 'Every video', value: 'every' as GateFrequency },
                { label: 'Every 2 videos', value: 'every-n' as GateFrequency, n: 2 },
                { label: 'Every 3 videos', value: 'every-n' as GateFrequency, n: 3 },
                { label: 'Every 5 videos', value: 'every-n' as GateFrequency, n: 5 },
                { label: 'Once per session', value: 'session' as GateFrequency },
              ] as Array<{ label: string; value: GateFrequency; n?: number }>).map((opt) => {
                const isActive =
                  opt.value === 'every-n'
                    ? gateFrequency === 'every-n' && videosPerGate === opt.n
                    : gateFrequency === opt.value;
                return (
                  <Pressable
                    key={opt.label}
                    style={[
                      styles.optionChip,
                      { paddingHorizontal: scaled.chipPadH, paddingVertical: scaled.chipPadV },
                      isActive && styles.optionChipActive,
                    ]}
                    onPress={() => {
                      setGateFrequency(opt.value);
                      if (opt.n !== undefined) setVideosPerGate(opt.n);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        { fontSize: scaled.chipFont },
                        isActive && styles.optionChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Playback Controls */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="play-circle" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.sectionTitleFont }]}>Playback</Text>
        </View>
        <View style={styles.controlRow}>
          <View style={styles.controlLabel}>
            <Text style={[styles.controlTitle, { fontSize: scaled.controlTitleFont }]}>Auto-Play</Text>
            <Text style={[styles.controlDescription, { fontSize: scaled.descFont }]}>
              {autoPlayEnabled
                ? 'Next video plays automatically'
                : 'Videos stop after each one ends'}
            </Text>
          </View>
          <Switch
            value={autoPlayEnabled}
            onValueChange={toggleAutoPlay}
            trackColor={{ false: colors.border, true: colors.crtBlue }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  controlLabel: {
    flex: 1,
    marginRight: spacing.sm,
  },
  controlTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  controlDescription: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.crtBlue,
  },
  optionChipText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionChipTextActive: {
    color: colors.crtBlue,
  },
  bottomSpacer: {
    height: 40,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.border,
  },
  stepperButtonText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: typography.body.fontFamily,
  },
  stepperButtonTextDisabled: {
    color: colors.textSecondary,
  },
  stepperValue: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
});
