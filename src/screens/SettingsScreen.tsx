import React, { useMemo, useState } from 'react';
import { Text, View, StyleSheet, Pressable, TextInput } from 'react-native';
import * as Notifications from 'expo-notifications';

import Card from '@/components/shared/Card';
import tokens from '@/components/tokens';
import { CONFIG } from '@/config';
import useBleStore from '@/stores/bleStore';
import useAlarmStore from '@/stores/alarmStore';
import useSleepStore from '@/stores/sleepStore';
import { useSensorData } from '@/hooks';
import { clearNightLogs } from '@/services/storage/nightLogStorage';

const WAKE_WINDOW_OPTIONS = [15, 20, 30];
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

export function SettingsScreen() {
  const bleConnectionState = useBleStore((state) => state.connectionState);
  const bleConnectedDeviceId = useBleStore((state) => state.connectedDeviceId);
  const bleError = useBleStore((state) => state.error);
  const startScan = useBleStore((state) => state.startScan);
  const disconnect = useBleStore((state) => state.disconnect);

  const alarmConfig = useAlarmStore((state) => state.config);
  const setAlarm = useAlarmStore((state) => state.setAlarm);
  const clearAlarmState = useAlarmStore((state) => state.clearAlarmState);
  const recalculateAfterTimezoneChange = useAlarmStore((state) => state.recalculateAfterTimezoneChange);

  const resetNight = useSleepStore((state) => state.resetNight);
  const sensor = useSensorData();

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tempTarget, setTempTarget] = useState<string>('21.5');

  const connectionLabel = useMemo(() => {
    if (!bleConnectedDeviceId) {
      return bleConnectionState;
    }
    return `${bleConnectionState} (${bleConnectedDeviceId})`;
  }, [bleConnectionState, bleConnectedDeviceId]);

  const signalStrength = useMemo(() => {
    if (bleConnectionState !== 'connected') {
      return 'Offline';
    }
    if (!sensor) {
      return 'Unknown';
    }

    const ageMs = Date.now() - sensor.timestamp;
    if (ageMs < 5000) {
      return 'Strong';
    }
    if (ageMs < 15000) {
      return 'Fair';
    }
    return 'Weak';
  }, [bleConnectionState, sensor]);

  const onWakeWindowSelect = (minutes: number) => {
    if (!alarmConfig.targetTime) {
      setStatusMessage('Set an alarm time before saving wake window preferences.');
      return;
    }

    setAlarm({
      ...alarmConfig,
      windowMinutes: minutes,
      enabled: alarmConfig.enabled,
    });
    setStatusMessage(`Wake window set to ±${minutes} min.`);
  };

  const onRequestNotificationPermission = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      setStatusMessage('Notifications are already enabled.');
      return;
    }

    const next = await Notifications.requestPermissionsAsync();
    setStatusMessage(next.granted ? 'Notification permission granted.' : 'Notification permission denied.');
  };

  const onReconnect = async () => {
    await startScan();
    setStatusMessage('Started BLE scan.');
  };

  const onDisconnect = async () => {
    await disconnect();
    setStatusMessage('Disconnected BLE device.');
  };

  const onClearAlarm = () => {
    clearAlarmState();
    setStatusMessage('Alarm settings cleared.');
  };

  const onRecalculateTimezone = () => {
    recalculateAfterTimezoneChange();
    setStatusMessage('Alarm recalculated for current timezone.');
  };

  const onResetCurrentNight = () => {
    resetNight();
    setStatusMessage('Current sleep session reset.');
  };

  const onClearHistory = async () => {
    await clearNightLogs();
    setStatusMessage('Stored sleep history cleared.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Device, preference, and app information.</Text>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>DEVICE</Text>
        <SettingRow label="Device ID" value={bleConnectedDeviceId ?? 'None'} />
        <SettingRow label="Signal strength" value={signalStrength} />
        <SettingRow label="Connection" value={connectionLabel} />
        <View style={styles.rowButtons}>
          <ActionButton label="Scan" onPress={() => { void onReconnect(); }} />
          <ActionButton label="Forget device" onPress={() => { void onDisconnect(); }} tone="danger" />
        </View>
        {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <SettingRow
          label="Temp target"
          control={(
            <TextInput
              style={styles.input}
              value={tempTarget}
              onChangeText={setTempTarget}
              keyboardType="decimal-pad"
              placeholder="21.5"
              placeholderTextColor={tokens.COLORS.TEXT_DIM}
              selectionColor={tokens.COLORS.ACCENT}
            />
          )}
        />
        <SettingRow
          label="Wake window"
          control={(
            <View style={styles.selectorRow}>
              {WAKE_WINDOW_OPTIONS.map((minutes) => {
                const active = alarmConfig.windowMinutes === minutes;
                return (
                  <Pressable
                    key={minutes}
                    style={[styles.selectorPill, active && styles.selectorPillActive]}
                    onPress={() => onWakeWindowSelect(minutes)}
                  >
                    <Text style={[styles.selectorPillText, active && styles.selectorPillTextActive]}>{`±${minutes}`}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <SettingRow label="App version" value={APP_VERSION} />
        <SettingRow label="Build number" value={BUILD_NUMBER} />
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <ActionButton label="Enable notifications" onPress={() => { void onRequestNotificationPermission(); }} />
        <ActionButton label="Recalculate timezone" onPress={onRecalculateTimezone} />
        <ActionButton label="Clear alarm state" onPress={onClearAlarm} tone="danger" />
        <ActionButton label="Reset current night" onPress={onResetCurrentNight} />
        <ActionButton label="Clear sleep history" onPress={() => { void onClearHistory(); }} tone="danger" />
      </Card>

      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
    </View>
  );
}

function SettingRow({ label, value, control }: { label: string; value?: string; control?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {control ?? <Text style={styles.rowValue}>{value}</Text>}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        tone === 'secondary' && styles.actionButtonSecondary,
        tone === 'danger' && styles.actionButtonDanger,
      ]}
      onPress={onPress}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
    padding: tokens.SPACING.LG,
    gap: tokens.SPACING.MD,
  },
  title: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.XL,
    fontFamily: tokens.TYPOGRAPHY.DISPLAY,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: tokens.SPACING.XS,
    marginBottom: tokens.SPACING.SM,
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  sectionCard: {
    gap: tokens.SPACING.SM,
  },
  sectionLabel: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: tokens.COLORS.BORDER,
  },
  rowLabel: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  rowValue: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    maxWidth: '55%',
    textAlign: 'right',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
    paddingTop: tokens.SPACING.SM,
  },
  input: {
    minWidth: 92,
    color: tokens.COLORS.TEXT_PRIMARY,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    fontSize: tokens.FONT_SIZES.SM,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: tokens.COLORS.SURFACE,
    borderRadius: tokens.RADIUS.FULL,
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.SM,
    textAlign: 'right',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
  },
  selectorPill: {
    borderWidth: 1,
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: tokens.COLORS.SURFACE,
    paddingHorizontal: tokens.SPACING.SM,
    paddingVertical: tokens.SPACING.SM,
    borderRadius: tokens.RADIUS.FULL,
  },
  selectorPillActive: {
    backgroundColor: tokens.COLORS.ACCENT,
    borderColor: tokens.COLORS.ACCENT,
  },
  selectorPillText: {
    color: tokens.COLORS.TEXT_SECONDARY,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
    fontSize: tokens.FONT_SIZES.XS,
  },
  selectorPillTextActive: {
    color: tokens.COLORS.WHITE,
  },
  actionButton: {
    flex: 1,
    marginTop: tokens.SPACING.XS,
    borderRadius: tokens.RADIUS.FULL,
    backgroundColor: tokens.COLORS.ACCENT,
    paddingVertical: tokens.SPACING.SM,
    paddingHorizontal: tokens.SPACING.MD,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: tokens.COLORS.SURFACE_ELEVATED,
  },
  actionButtonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.COLORS.DANGER,
  },
  actionButtonText: {
    color: tokens.COLORS.TEXT_PRIMARY,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
  errorText: {
    marginTop: tokens.SPACING.SM,
    color: tokens.COLORS.DANGER,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.BODY,
  },
  statusMessage: {
    marginTop: tokens.SPACING.SM,
    color: tokens.COLORS.SUCCESS,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.MEDIUM,
  },
});
