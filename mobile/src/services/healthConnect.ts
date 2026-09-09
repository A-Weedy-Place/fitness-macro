import { Platform } from 'react-native';
import { buildHealthActivities, HealthImportBatch, HealthRecord, healthSyncWindow, latestHealthWeights } from '../logic/healthImport';
export { reconcileHealthConnectSync } from '../logic/healthImport';

export interface HealthConnectStatus {
  available: boolean;
  permissionGranted: boolean;
  developmentBuildRequired: boolean;
  message: string;
}
export interface HealthConnectSyncResult extends HealthImportBatch { status: HealthConnectStatus }
type HealthModule = typeof import('react-native-health-connect');
type TimeRange = { operator: 'between'; startTime: string; endTime: string };

const permissions = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'Weight' as const }
];

/** Read-only, foreground sync. Failed or incomplete scopes never erase good local data. */
export async function syncHealthConnect(requestAccess = false, days = 30, timeZone?: string): Promise<HealthConnectSyncResult> {
  const empty = (status: HealthConnectStatus): HealthConnectSyncResult => ({ status, activities: [], weights: [], syncWindow: null });
  if (Platform.OS !== 'android') return empty({ available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is available on Android only.' });
  try {
    const health = await import('react-native-health-connect');
    if (!await health.initialize()) return empty({ available: false, permissionGranted: false, developmentBuildRequired: false, message: 'Health Connect is not available or needs an update.' });
    let granted: Array<{ accessType: 'read' | 'write'; recordType: string }> = await health.getGrantedPermissions();
    const has = (recordType: string) => granted.some((item) => item.accessType === 'read' && item.recordType === recordType);
    const missing = permissions.filter((permission) => !has(permission.recordType));
    if (requestAccess && missing.length) { await health.requestPermission(missing); granted = await health.getGrantedPermissions(); }
    const canReadSessions = has('ExerciseSession');
    const canReadCalories = has('ActiveCaloriesBurned');
    const canReadDistance = has('Distance');
    const canReadWeight = has('Weight');
    const permissionGranted = canReadSessions || canReadCalories || canReadWeight;
    if (!permissionGranted) return empty({ available: true, permissionGranted: false, developmentBuildRequired: false, message: 'Allow workout, active-calorie, distance, and weight access to import Health Connect data.' });
    const window = healthSyncWindow(new Date(), days, timeZone);
    const timeRangeFilter: TimeRange = { operator: 'between', startTime: window.startTime, endTime: window.endTime };
    const activitiesComplete = canReadSessions && canReadCalories;
    const sessions = activitiesComplete ? await readAllRecords(health, 'ExerciseSession', timeRangeFilter) : [];
    const weightRecords = canReadWeight ? await readAllRecords(health, 'Weight', timeRangeFilter) : [];
    const activities = activitiesComplete ? await buildHealthActivities({
      sessions, window, timeZone,
      aggregateCalories: async (interval) => {
        const result = await health.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: { operator: 'between', ...interval } });
        return Number(result.ACTIVE_CALORIES_TOTAL?.inKilocalories || 0);
      },
      aggregateDistance: canReadDistance ? async (interval) => {
        const result = await health.aggregateRecord({ recordType: 'Distance', timeRangeFilter: { operator: 'between', ...interval } });
        const meters = Number(result.DISTANCE?.inMeters || 0);
        if (!Number.isFinite(meters) || meters < 0) throw new Error('Health Connect returned an invalid distance.');
        return meters > 0 ? meters : undefined;
      } : undefined
    }) : [];
    const weights = latestHealthWeights(weightRecords, timeZone);
    const workoutCount = activities.filter((activity) => activity.type !== 'health_connect_daily').length;
    const details = [`${workoutCount} workout record${workoutCount === 1 ? '' : 's'}`, `${weights.length} weight check-in${weights.length === 1 ? '' : 's'}`];
    const limitations = [
      !activitiesComplete && 'Allow both workout sessions and active calories to refresh activity; existing imports were kept.',
      !canReadDistance && 'Distance permission is not enabled.',
      !canReadWeight && 'Weight permission is not enabled.'
    ].filter(Boolean).join(' ');
    return {
      status: { available: true, permissionGranted: true, developmentBuildRequired: false, message: `Connected. Synced ${details.join(' and ')}. ${limitations} Sync runs when the app opens or you refresh.`.trim() },
      activities, weights, syncWindow: { ...window, activitiesComplete, weightsComplete: canReadWeight }
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const nativeMissing = /TurboModule|Native module|RNHealthConnect|could not be found/i.test(detail);
    return empty({ available: false, permissionGranted: false, developmentBuildRequired: nativeMissing, message: nativeMissing ? 'Install the Weed Fitness APK to enable Health Connect.' : `Health Connect sync did not finish; existing records were kept. ${detail}` });
  }
}

export async function openHealthConnectSettings(): Promise<void> { const health = await import('react-native-health-connect'); health.openHealthConnectSettings(); }

async function readAllRecords(health: HealthModule, recordType: 'ExerciseSession' | 'Weight', timeRangeFilter: TimeRange): Promise<HealthRecord[]> {
  const records: HealthRecord[] = []; const seenTokens = new Set<string>(); let pageToken: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const response = await health.readRecords(recordType, { timeRangeFilter, ascendingOrder: true, pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
    records.push(...response.records);
    const nextToken = String((response as { pageToken?: string }).pageToken || '');
    if (!nextToken) {
      const byId = new Map<string, HealthRecord>();
      for (const record of records) byId.set(String(record.metadata?.id || record.metadata?.clientRecordId || `${record.metadata?.dataOrigin}_${record.startTime || record.time}_${record.endTime || ''}`), record);
      return [...byId.values()];
    }
    if (seenTokens.has(nextToken)) throw new Error('Health Connect repeated a history page; retry sync.');
    seenTokens.add(nextToken); pageToken = nextToken;
  }
  throw new Error('Health Connect history exceeded the safe page limit; existing records were kept.');
}
