import React, { useMemo, useState } from 'react';
import { Text, View, StyleSheet, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';

import ConnectionIndicator from '@/components/shared/ConnectionIndicator';
import tokens from '@/components/tokens';
import { CONFIG } from '@/config';
import useBleStore from '@/stores/bleStore';
import useAlarmStore from '@/stores/alarmStore';
import useSleepStore from '@/stores/sleepStore';
import { clearNightLogs } from '@/services/storage/nightLogStorage';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = 'MVP';

export function SettingsScreen() {
  const bleConnectionState = useBleStore((state) => state.connectionState);
  const bleConnectedDeviceId = useBleStore((state) => state.connectedDeviceId);
  const disconnect = useBleStore((state) => state.disconnect);
  const startScan = useBleStore((state) => state.startScan);

  const alarmConfig = useAlarmStore((state) => state.config);
  const setAlarm = useAlarmStore((state) => state.setAlarm);
  const clearAlarmState = useAlarmStore((state) => state.clearAlarmState);
  const recalculateAfterTimezoneChange = useAlarmStore((state) => state.recalculateAfterTimezoneChange);

  const resetNight = useSleepStore((state) => state.resetNight);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tempTarget, setTempTarget] = useState<string>('21.5');
  const [wakeWindow, setWakeWindow] = useState<number>(alarmConfig.windowMinutes ?? 30);

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

  const handleWakeWindowChange = (minutes: number) => {
    setWakeWindow(minutes);
    setAlarm({
      ...alarmConfig,
      windowMinutes: minutes,
    });
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* DEVICE Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DEVICE</Text>
        <SettingRow label="Device ID" value={bleConnectedDeviceId ?? 'None'} dim />
        <SettingRow label="Status" control={<ConnectionIndicator />} />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => { void onDisconnect(); }}
        >
          <Text style={styles.actionRowLabel}>Disconnect Device</Text>
          <Text style={styles.actionRowValue}>Remove</Text>
        </TouchableOpacity>
      </View>

      {/* PREFERENCES Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <SettingRow label="Temperature Target" value={`${tempTarget}°C`} />
        <SettingRow
          label="Wake Window"
          value={`±${wakeWindow} min`}
          control={(
            <View style={styles.windowSelector}>
              {[15, 20, 30].map((minutes) => (
                <TouchableOpacity
                  key={minutes}
                  style={[
                    styles.windowPill,
                    wakeWindow === minutes && styles.windowPillActive,
                  ]}
                  onPress={() => handleWakeWindowChange(minutes)}
                >
                  <Text
                    style={[
                      styles.windowPillText,
                      wakeWindow === minutes && styles.windowPillTextActive,
                    ]}
                  >
                    {minutes}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      </View>

      {/* ABOUT Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <SettingRow label="Version" value={APP_VERSION} dim />
        <SettingRow label="Build" value={BUILD_NUMBER} dim isLast />
      </View>

      {/* TOOLS Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <ActionButton label="Enable notifications" onPress={() => { void onRequestNotificationPermission(); }} />
        <ActionButton label="Recalculate timezone" onPress={onRecalculateTimezone} />
        <ActionButton label="Clear alarm state" onPress={onClearAlarm} tone="danger" />
        <ActionButton label="Reset current night" onPress={onResetCurrentNight} />
        <ActionButton label="Clear sleep history" onPress={() => { void onClearHistory(); }} tone="danger" />
      </View>

      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  control,
  dim = false,
  isLast = false,
}: {
  label: string;
  value?: string;
  control?: React.ReactNode;
  dim?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {control ?? (
        <Text style={[styles.rowValue, dim && styles.rowValueDim]}>{value}</Text>
      )}
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
  tone?: 'primary' | 'danger';
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        tone === 'danger' && styles.actionButtonDanger,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionButtonText,
          tone === 'danger' && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: tokens.COLORS.BACKGROUND,
  },
  container: {
    padding: tokens.SPACING.XL,
    paddingBottom: tokens.SPACING.XXL,
    gap: tokens.SPACING.XL,
  },
  title: {
    fontSize: tokens.FONT_SIZES.XXL,
    fontFamily: tokens.TYPOGRAPHY.display,
    color: tokens.COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  section: {
    marginTop: tokens.SPACING.XXL,
    gap: 0,
  },
  sectionLabel: {
    fontSize: tokens.FONT_SIZES.XS,
    letterSpacing: 4,
    color: tokens.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    fontFamily: tokens.TYPOGRAPHY.medium,
    marginBottom: tokens.SPACING.MD,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.SPACING.LG,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.COLORS.BORDER,
  },
  rowLabel: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  rowValue: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  rowValueDim: {
    color: tokens.COLORS.TEXT_DIM,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.SPACING.LG,
    borderBottomWidth: 1,
    borderBottomColor: tokens.COLORS.BORDER,
  },
  actionRowLabel: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  actionRowValue: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.DANGER,
  },
  windowSelector: {
    flexDirection: 'row',
    gap: tokens.SPACING.SM,
  },
  windowPill: {
    borderWidth: 1,
    borderColor: tokens.COLORS.BORDER,
    backgroundColor: tokens.COLORS.SURFACE,
    paddingHorizontal: tokens.SPACING.MD,
    paddingVertical: tokens.SPACING.SM,
    borderRadius: tokens.RADIUS.FULL,
  },
  windowPillActive: {
    backgroundColor: tokens.COLORS.ACCENT,
    borderColor: tokens.COLORS.ACCENT,
  },
  windowPillText: {
    fontSize: tokens.FONT_SIZES.XS,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_SECONDARY,
  },
  windowPillTextActive: {
    color: tokens.COLORS.TEXT_PRIMARY,
  },
  actionButton: {
    width: '100%',
    backgroundColor: tokens.COLORS.ACCENT,
    borderRadius: tokens.RADIUS.XL,
    paddingVertical: tokens.SPACING.LG,
    paddingHorizontal: tokens.SPACING.MD,
    alignItems: 'center',
    marginTop: tokens.SPACING.MD,
  },
  actionButtonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.COLORS.DANGER,
  },
  actionButtonText: {
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    color: tokens.COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  actionButtonTextDanger: {
    color: tokens.COLORS.DANGER,
  },
  statusMessage: {
    marginTop: tokens.SPACING.MD,
    color: tokens.COLORS.SUCCESS,
    fontSize: tokens.FONT_SIZES.SM,
    fontFamily: tokens.TYPOGRAPHY.medium,
    textAlign: 'center',
  },
});
