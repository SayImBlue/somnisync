# SomniSync — BLE Contract v1.0

## Rules
- This document is frozen after Week 1. No changes without explicit agreement from both Al Farouk (app) and the firmware developer.
- All payloads are JSON encoded as UTF-8 strings over BLE characteristics.

## Service
- Name: SomniSync Primary Service
- UUID: (custom 128-bit — to be finalized and filled here before end of S1)

## Characteristics

### Temperature
- UUID: placeholder
- Properties: Notify
- Payload: { "temp": 23.5 }   ← float, Celsius, 1 decimal

### Luminosity  
- UUID: placeholder
- Properties: Notify
- Payload: { "lux": 412 }     ← integer, raw LDR ADC value 0–4095

### LightControl
- UUID: placeholder
- Properties: Write
- Payload: { "brightness": 75 }  ← integer 0–100, maps to PWM duty cycle

### TempSetpoint
- UUID: placeholder
- Properties: Write + Read
- Payload: { "target": 20.0 }   ← float, Celsius, target room temperature

### SleepPhase
- UUID: placeholder
- Properties: Notify (phone → ESP32, app writes inferred phase)
- Payload: { "phase": "LIGHT" }  ← enum: "LIGHT" | "DEEP" | "TRANSITIONAL" | "AWAKE"

## Notify interval
- ESP32 sends Temperature + Luminosity every 30 seconds
- App sends SleepPhase update whenever phase changes (event-driven, not periodic)

## SensorData TypeScript interface (canonical)
```ts
export interface SensorData {
	temperature: number      // Celsius
	luminosity: number       // raw 0–4095
	timestamp: number        // Date.now()
}

export type SleepPhase = 'LIGHT' | 'DEEP' | 'TRANSITIONAL' | 'AWAKE'

export interface AlarmConfig {
	targetTime: string       // ISO string
	windowMinutes: number    // default 30
	enabled: boolean
}

export interface SleepPhaseEntry {
	phase: SleepPhase
	startTime: number
	endTime: number
}

export interface NightLog {
	date: string
	phases: SleepPhaseEntry[]
	sensorSnapshots: SensorData[]
}
```

## Status
- [ ] UUIDs finalized
- [ ] Tested on physical device
- [ ] Firmware confirmed compatible
