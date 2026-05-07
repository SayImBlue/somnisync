import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Platform, TouchableOpacity } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import Card from '@/components/shared/Card';
import tokens from '@/components/tokens';
import useAlarmStore from '@/stores/alarmStore';

const WINDOW_OPTIONS = [15, 20, 30];

const toInitialTime = (targetTime: string): Date => {
  const parsed = targetTime ? new Date(targetTime) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
};

const formatTimeLabel = (time: Date): string =>
  time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const normalizeWindowMinutes = (windowMinutes: number | undefined): number =>
  WINDOW_OPTIONS.includes(windowMinutes ?? 0) ? (windowMinutes as number) : 30;

export function AlarmScreen() {
  const config = useAlarmStore((state) => state.config);
  const engineState = useAlarmStore((state) => state.engineState);
  const wakeSequenceProgress = useAlarmStore((state) => state.wakeSequenceProgress);
  const setAlarm = useAlarmStore((state) => state.setAlarm);
  const armAlarm = useAlarmStore((state) => state.armAlarm);
  const disarmAlarm = useAlarmStore((state) => state.disarmAlarm);
  const snooze = useAlarmStore((state) => state.snooze);
  const stopWakeSequence = useAlarmStore((state) => state.stopWakeSequence);

  const [time, setTime] = useState<Date>(toInitialTime(config.targetTime));
  const [windowMinutes, setWindowMinutes] = useState<number>(normalizeWindowMinutes(config.windowMinutes));
  const [enabled, setEnabled] = useState<boolean>(config.enabled);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWakeOverlayVisible = engineState === 'wake-sequence' || engineState === 'triggered';

  const nextAlarmLabel = useMemo(() => {
    if (!config.targetTime) {
      return 'No alarm set';
    }
    return formatTimeLabel(new Date(config.targetTime));
  }, [config.targetTime]);

  const wakeWindowLabel = useMemo(() => `Wake window ±${windowMinutes} min`, [windowMinutes]);

  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, []);

  const onTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTime(selectedDate);
    }
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  const onSave = () => {
    const nextConfig = {
      targetTime: time.toISOString(),
      windowMinutes,
      enabled: true,
    };

    setAlarm(nextConfig);
    setEnabled(true);
    armAlarm();

    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
    setConfirmationMessage(`Alarm set for ${formatTimeLabel(time)}`);
    confirmationTimeoutRef.current = setTimeout(() => {
      setConfirmationMessage('');
      confirmationTimeoutRef.current = null;
    }, 2500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alarm</Text>

      <Card style={styles.timeCard}>
        <Text style={styles.sectionLabel}>Wake Time</Text>
        <TouchableOpacity style={styles.timeButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.timeButtonText}>{formatTimeLabel(time)}</Text>
        </TouchableOpacity>
        <Text style={styles.timeSubtext}>{wakeWindowLabel}</Text>
        {showPicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}
      </Card>

      <Card style={styles.windowCard}>
        <Text style={styles.sectionLabel}>Wake Window</Text>
        <View style={styles.pillsRow}>
          {WINDOW_OPTIONS.map((option) => {
            const active = option === windowMinutes;
            return (
              <Pressable
                key={option}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setWindowMinutes(option)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{`±${option} min`}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.sectionLabel}>Enable Alarm</Text>
            <Text style={styles.muted}>Next: {nextAlarmLabel}</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: tokens.COLORS.BORDER, true: tokens.COLORS.ACCENT }}
            thumbColor={tokens.COLORS.TEXT_PRIMARY}
          />
        </View>
      </Card>

      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Save Alarm</Text>
      </Pressable>

      {confirmationMessage ? <Text style={styles.confirmationText}>{confirmationMessage}</Text> : null}

      {isWakeOverlayVisible && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTime}>{formatTimeLabel(time)}</Text>
            <Text style={styles.overlayTitle}>Time to wake up</Text>
            <Text style={styles.overlayText}>{Math.round(wakeSequenceProgress * 100)}% of wake sequence complete</Text>
            <View style={styles.overlayActions}>
              <Pressable
                style={[styles.overlayButton, styles.outlinedButton]}
                onPress={() => {
                  snooze();
                }}
              >
                <Text style={styles.outlinedButtonText}>Snooze</Text>
              </Pressable>
              <Pressable
                style={[styles.overlayButton, styles.dismissButton]}
                onPress={() => {
                  stopWakeSequence();
                  disarmAlarm();
                }}
              >
                <Text style={styles.overlayButtonText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
    padding: tokens.SPACING.LG,
    gap: tokens.SPACING.LG,
  },
  title: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.4,
  },
  timeCard: {
    alignItems: 'center',
    gap: tokens.SPACING.SM,
  },
  windowCard: {
    gap: tokens.SPACING.SM,
  },
  toggleCard: {
    gap: tokens.SPACING.SM,
  },
  sectionLabel: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  timeButton: {
    paddingVertical: tokens.SPACING.SM,
    paddingHorizontal: tokens.SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonText: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.HERO,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -2,
  },
  timeSubtext: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
  },
  pill: {
    paddingVertical: tokens.SPACING.SM,
    paddingHorizontal: tokens.SPACING.MD,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: tokens.COLORS.SURFACE,
  },
  pillActive: {
    backgroundColor: tokens.COLORS.ACCENT,
    borderColor: tokens.COLORS.ACCENT,
  },
  pillText: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  pillTextActive: {
    color: tokens.COLORS.WHITE,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muted: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  saveButton: {
    width: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.FULL,
    paddingVertical: tokens.SPACING.MD,
    alignItems: 'center',
  },
  saveButtonText: {
    color: tokens.COLORS.WHITE,
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
  },
  confirmationText: {
    color: tokens.COLORS.SUCCESS,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.SPACING.LG,
  },
  overlayCard: {
    width: '100%',
    alignItems: 'center',
    gap: tokens.SPACING.SM,
  },
  overlayTime: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.HERO,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -2,
  },
  overlayTitle: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
  },
  overlayText: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
    marginTop: tokens.SPACING.LG,
    width: '100%',
  },
  overlayButton: {
    flex: 1,
    paddingVertical: tokens.SPACING.MD,
    borderRadius: tokens.RADIUS.FULL,
    alignItems: 'center',
  },
  outlinedButton: {
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: 'transparent',
  },
  dismissButton: {
    backgroundColor: tokens.COLORS.ACCENT,
  },
  overlayButtonText: {
    color: tokens.COLORS.WHITE,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
  },
  outlinedButtonText: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
  },
});
