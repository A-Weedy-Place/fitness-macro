import { Platform } from 'react-native';
import { ActivityEntry } from '../types';

export interface HealthConnectStatus {
  available: boolean;
  permissionGranted: boolean;
  developmentBuildRequired: boolean;
  message: string;
}

export interface HealthConnectSyncResult {
  status: HealthConnectStatus;
  activities: ActivityEntry[];
}

const permissions = [
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'TotalCaloriesBurned' as const }
];

export async function syncStravaCaloriesFromHealthConnect(requestAccess = false, days = 30): Promise<HealthConnectSyncResult> {
  if (Platform.OS !== 'android') return { status: { available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is available on Android only.' }, activities: [] };
  try {
    const health = await import('react-native-health-connect');
    const initialized = await health.initialize();
    if (!initialized) return { status: { available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is not available or needs an update.' }, activities: [] };
    let granted: Array<{ accessType: 'read' | 'write'; recordType: string }> = await health.getGrantedPermissions();
    let permissionGranted = permissions.some((required) => granted.some((item) => item.accessType === required.accessType && item.recordType === required.recordType));
    if (!permissionGranted && requestAccess) {
      granted = await health.requestPermission(permissions);
      permissionGranted = permissions.some((required) => granted.some((item) => item.accessType === required.accessType && item.recordType === required.recordType));
    }
    if (!permissionGranted) return { status: { available: true, permissionGranted: false, developmentBuildRequired: false, message: 'Permission is needed once to read Strava calorie records.' }, activities: [] };
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const options = { timeRangeFilter: { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() }, dataOriginFilter: ['com.strava'] };
    let response = await health.readRecords('ActiveCaloriesBurned', options);
    let records = recordsFrom(response);
    if (!records.length) {
      response = await health.readRecords('TotalCaloriesBurned', options);
      records = recordsFrom(response);
    }
    const activities = records.map((record) => {
      const startTime = String(record.startTime);
      const endTime = String(record.endTime);
      const id = String(record.metadata?.id || `${startTime}_${endTime}`);
      return {
        id: `health_strava_${id}`,
        date: localDate(startTime),
        name: 'Strava activity',
        source: 'strava' as const,
        type: 'health_connect',
        durationMinutes: Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)),
        caloriesEstimated: Math.max(0, Number(record.energy?.inKilocalories || 0)),
        createdAt: String(record.metadata?.lastModifiedTime || endTime)
      };
    }).filter((activity) => activity.caloriesEstimated > 0);
    return { status: { available: true, permissionGranted: true, developmentBuildRequired: false, message: activities.length ? `${activities.length} Strava calorie record(s) available.` : 'Connected. No recent Strava calorie records were found.' }, activities };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const nativeMissing = /TurboModule|Native module|RNHealthConnect|could not be found/i.test(detail);
    return { status: { available: false, permissionGranted: false, developmentBuildRequired: nativeMissing, message: nativeMissing ? 'Install the FitnessMacro development build to enable Health Connect.' : `Health Connect error: ${detail}` }, activities: [] };
  }
}

export async function openHealthConnectSettings(): Promise<void> {
  const health = await import('react-native-health-connect');
  health.openHealthConnectSettings();
}

function recordsFrom(value: unknown): Array<Record<string, any>> {
  const response = value as { records?: Array<Record<string, any>>; result?: Array<Record<string, any>> };
  return response.records || response.result || [];
}

function localDate(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
