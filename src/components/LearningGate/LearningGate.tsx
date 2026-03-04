import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Question } from '@src/types/learningGate';
import { generateQuestion } from '@src/utils/learningGate';
import { colors, spacing, borderRadius, typography } from '@src/constants/theme';

type Phase = 'question' | 'wrong' | 'correct' | 'unlocked';

interface LearningGateProps {
  visible: boolean;
  childAge: number;
  onPass: () => void;
  onDismiss?: () => void;
}

const MAX_ATTEMPTS = 3;

export default function LearningGate({ visible, childAge, onPass, onDismiss }: LearningGateProps) {
  const [question, setQuestion] = useState<Question>(() => generateQuestion(childAge));
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;

  // Reset when visibility changes
  useEffect(() => {
    if (visible) {
      setQuestion(generateQuestion(childAge));
      setSelected(null);
      setAttempts(0);
      setPhase('question');
    }
  }, [visible, childAge]);

  // Auto-advance after correct
  useEffect(() => {
    if (phase === 'correct') {
      Animated.sequence([
        Animated.timing(celebrateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(celebrateAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(celebrateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => {
        onPass();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, onPass, celebrateAnim]);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleOptionPress = useCallback((index: number) => {
    if (phase !== 'question') return;

    setSelected(index);

    if (index === question.correctIndex) {
      setPhase('correct');
      return;
    }

    // Wrong answer
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    triggerShake();

    if (newAttempts >= MAX_ATTEMPTS) {
      // Show correct answer + unlock
      setTimeout(() => {
        setPhase('unlocked');
      }, 800);
    } else {
      // Flash red then reset with a new question (same type)
      setTimeout(() => {
        setSelected(null);
        setPhase('question');
        // Generate fresh question of the same type if possible
        let next = generateQuestion(childAge);
        let tries = 0;
        while (next.type !== question.type && tries < 5) {
          next = generateQuestion(childAge);
          tries++;
        }
        setQuestion(next);
      }, 800);
    }
  }, [phase, question, attempts, childAge, triggerShake]);

  const getButtonStyle = (index: number) => {
    if (phase === 'correct' && index === question.correctIndex) {
      return styles.buttonCorrect;
    }
    if (phase === 'unlocked' && index === question.correctIndex) {
      return styles.buttonCorrect;
    }
    if ((phase === 'wrong' || selected === index) && index === selected && index !== question.correctIndex) {
      return styles.buttonWrong;
    }
    return null;
  };

  const getButtonTextStyle = (index: number) => {
    if (phase === 'correct' && index === question.correctIndex) return styles.buttonTextCorrect;
    if (phase === 'unlocked' && index === question.correctIndex) return styles.buttonTextCorrect;
    if (selected === index && index !== question.correctIndex) return styles.buttonTextWrong;
    return null;
  };

  const renderVisual = () => {
    if (!question.visual) return null;

    // Color type — render colored circle
    if (question.type === 'color' && question.visual.startsWith('#')) {
      return (
        <View style={[styles.colorCircle, { backgroundColor: question.visual }]} />
      );
    }

    // Emoji visual
    return (
      <Text style={styles.visualEmoji}>{question.visual}</Text>
    );
  };

  const renderAttemptDots = () => (
    <View style={styles.attemptDots}>
      {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < attempts ? styles.dotUsed : styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );

  const isYoungKid = childAge <= 6;

  const content = (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.card,
          isYoungKid && styles.cardYoung,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        {/* Header */}
        <Text style={[styles.headerText, isYoungKid && styles.headerTextYoung]}>
          {isYoungKid ? '🌟 Quick Question!' : '📚 Brain Check!'}
        </Text>

        {/* Visual */}
        {renderVisual()}

        {/* Question prompt */}
        <Text style={[styles.prompt, isYoungKid && styles.promptYoung]}>
          {question.prompt}
        </Text>

        {/* Answer buttons */}
        <View style={[styles.optionsGrid, isYoungKid && styles.optionsGridYoung]}>
          {question.options.map((option, index) => (
            <Pressable
              key={`${index}-${option}`}
              style={[
                styles.button,
                isYoungKid && styles.buttonYoung,
                getButtonStyle(index),
              ]}
              onPress={() => handleOptionPress(index)}
              disabled={phase !== 'question'}
            >
              <Text style={[
                styles.buttonText,
                isYoungKid && styles.buttonTextYoung,
                getButtonTextStyle(index),
              ]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Feedback */}
        {phase === 'correct' && (
          <Animated.Text style={[styles.feedbackText, styles.feedbackCorrect, { opacity: celebrateAnim }]}>
            🎉 Great job!
          </Animated.Text>
        )}

        {phase === 'unlocked' && (
          <View style={styles.unlockArea}>
            <Text style={styles.unlockHint}>
              The correct answer was highlighted above.
            </Text>
            <Pressable style={styles.watchNowButton} onPress={onPass}>
              <Text style={styles.watchNowText}>Watch Now →</Text>
            </Pressable>
          </View>
        )}

        {/* Attempt dots — shown during question phase */}
        {phase === 'question' && renderAttemptDots()}

        {/* Dismiss button (optional) */}
        {onDismiss && (
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>Skip</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...(Platform.OS === 'web'
      ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any)
      : { flex: 1 }),
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  cardYoung: {
    maxWidth: 520,
    padding: spacing.xl,
  },
  headerText: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 18,
    color: colors.crtBlue,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  headerTextYoung: {
    fontSize: 22,
  },
  visualEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 64,
  },
  colorCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  prompt: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 17,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  promptYoung: {
    fontSize: 22,
    lineHeight: 32,
  },
  optionsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  optionsGridYoung: {
    gap: spacing.md,
  },
  button: {
    minWidth: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  buttonYoung: {
    minWidth: 100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: colors.success,
  },
  buttonWrong: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.vhsRed,
  },
  buttonText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  buttonTextYoung: {
    fontSize: 20,
  },
  buttonTextCorrect: {
    color: colors.success,
  },
  buttonTextWrong: {
    color: colors.vhsRed,
  },
  feedbackText: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 28,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  feedbackCorrect: {
    color: colors.success,
  },
  unlockArea: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  unlockHint: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  watchNowButton: {
    backgroundColor: colors.crtBlue,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
  },
  watchNowText: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 18,
    color: colors.dark,
  },
  attemptDots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotEmpty: {
    backgroundColor: colors.border,
  },
  dotUsed: {
    backgroundColor: colors.vhsRed,
  },
  dismissButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  dismissText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
