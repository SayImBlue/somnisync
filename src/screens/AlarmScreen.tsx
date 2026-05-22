import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import Card from '@/components/shared/Card';
import tokens from '@/components/tokens';
import useAlarmStore from '@/stores/alarmStore';

const WAKE_WINDOW_OPTIONS = [15, 20, 30];

const toInitialTime = (targetTime: string): Date => {
  const parsed = targetTime ? new Date(targetTime) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
};

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

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
  const [windowMinutes, setWindowMinutes] = useState<number>(config.windowMinutes ?? 30);
  const [enabled, setEnabled] = useState<boolean>(config.enabled);
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const togglePosition = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const isWakeOverlayVisible = engineState === 'wake-sequence' || engineState === 'triggered';

  const handleToggleEnable = () => {
    const newValue = !enabled;
    setEnabled(newValue);

    Animated.timing(togglePosition, {
      toValue: newValue ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const toggleTranslate = togglePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  const onTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTime(selectedDate);
    }
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  const onSave = () => {
    setAlarm({
      targetTime: time.toISOString(),
      windowMinutes,
      enabled: true,
    });
    setEnabled(true);
    armAlarm();
  };

  return (
    <>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
        {/* Header */}
        <Text style={styles.title}>Alarm</Text>

        {/* Time Display Card */}
        <TouchableOpacity
          style={styles.timeCard}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.displayTime}>{formatTime(time)}</Text>
          <Text style={styles.tapToChange}>Tap to change</Text>
        </TouchableOpacity>

        {/* Date Time Picker */}
        {showPicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}

        {/* Wake Window Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>WAKE WINDOW</Text>
          <View style={styles.wakeWindowRow}>
            {WAKE_WINDOW_OPTIONS.map((minutes) => {
              const active = minutes === windowMinutes;
              return (
                <TouchableOpacity
                  key={minutes}
                  style={[
                    styles.wakePill,
                    active ? styles.wakePillActive : styles.wakePillInactive,
                  ]}
                  onPress={() => setWindowMinutes(minutes)}
                >
                  <Text style={[styles.wakePillText, active && styles.wakePillTextActive]}>
                    {`± ${minutes} min`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Enable Row */}
        <View style={styles.enableRow}>
          <Text style={styles.enableLabel}>Enable Alarm</Text>
          <TouchableOpacity
            style={[
              styles.togglePill,
              { backgroundColor: enabled ? tokens.COLORS.ACCENT : tokens.COLORS.BORDER },
            ]}
            onPress={handleToggleEnable}
          >
            <Animated.View
              style={[
                styles.toggleCircle,
                {
                  transform: [{ translateX: toggleTranslate }],
                  backgroundColor: enabled ? tokens.COLORS.WHITE : tokens.COLORS.TEXT_DIM,
                },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={onSave}>
          <Text style={styles.saveButtonText}>Save Alarm</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Wake Overlay Modal */}
      {isWakeOverlayVisible && (
        <Modal transparent visible={isWakeOverlayVisible}>
          <View style={styles.overlayContainer}>
            <Text style={styles.overlayTime}>{formatTime(time)}</Text>
            <Text style={styles.overlaySubtitle}>Time to wake up</Text>

            <View style={styles.overlayButtons}>
              <TouchableOpacity
                style={styles.snoozeButton}
                onPress={() => { void snooze(); }}
              >
                <Text style={styles.snoozeButtonText}>Snooze</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => {
                  void stopWakeSequence();
                  void disarmAlarm();
                }}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
  },
  container: {
    padding: tokens.SPACING.XL,
    gap: tokens.SPACING.XL,
  },
  title: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  timeCard: {
    backgroundColor: tokens.COLORS.SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    borderRadius: tokens.RADIUS.XXL,
    padding: tokens.SPACING.XL,
    marginTop: tokens.SPACING.XL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayTime: {
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -1.2,
  },
  tapToChange: {
    marginTop: tokens.SPACING.SM,
    fontSize: tokens.FONT_SIZES.XS,
    color: tokens.COLORS.TEXT_DIM,
    textAlign: 'center',
    fontFamily: tokens.TYPOGRAPHY.body,
  },
  sectionContainer: {
    marginTop: tokens.SPACING.XL,
    gap: tokens.SPACING.MD,
  },
  sectionLabel: {
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 4,
    color: tokens.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    fontFamily: tokens.TYPOGRAPHY.medium,
  },
  wakeWindowRow: {
    flexDirection: 'row',
    gap: tokens.SPACING.MD,
    marginTop: tokens.SPACING.MD,
  },
  wakePill: {
    paddingHorizontal: tokens.SPACING.LG,
    paddingVertical: tokens.SPACING.SM,
    borderRadius: tokens.RADIUS.FULL,
    borderWidth: 1,
  },
  wakePillActive: {
    backgroundColor: tokens.COLORS.ACCENT,
    borderColor: tokens.COLORS.ACCENT,
  },
  wakePillInactive: {
    backgroundColor: tokens.COLORS.SURFACE,
    borderColor: tokens.COLORS.BORDER,
  },
  wakePillText: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  wakePillTextActive: {
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  enableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.SPACING.XL,
  },
  enableLabel: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  togglePill: {
    width: 40,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  saveButton: {
    marginTop: tokens.SPACING.XL,
    width: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.XL,
    padding: tokens.SPACING.LG,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: tokens.FONT_SIZES.LG,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.SPACING.XL,
  },
  overlayTime: {
    fontSize: tokens.FONT_SIZES.DISPLAY,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -1.2,
  },
  overlaySubtitle: {
    marginTop: tokens.SPACING.MD,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  overlayButtons: {
    marginTop: tokens.SPACING.XXL,
    flexDirection: 'row',
    gap: tokens.SPACING.MD,
    width: '100%',
  },
  snoozeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    borderRadius: tokens.RADIUS.XL,
    padding: tokens.SPACING.LG,
    alignItems: 'center',
  },
  snoozeButtonText: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.XL,
    padding: tokens.SPACING.LG,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: tokens.FONT_SIZES.MD,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
});
