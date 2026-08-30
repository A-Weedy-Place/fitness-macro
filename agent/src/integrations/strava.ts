import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ActivityEntry } from '../contracts.js';

interface StravaSecrets {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteId?: number;
  scope?: string;
  updatedAt: string;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id?: number };
}

interface StravaActivity {
  id: number;
  name: string;
  type?: string;
  sport_type?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  calories?: number;
  kilojoules?: number;
  start_date_local: string;
}

const dataDir = path.resolve(process.env.AGENT_DATA_DIR || path.resolve(process.cwd(), 'data'));
const secretFile = path.resolve(dataDir, 'strava-secrets.json');
const temporaryStates = new Map<string, number>();

function configuration() {
  return {
    clientId: process.env.STRAVA_CLIENT_ID || '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || '',
    redirectUri: process.env.STRAVA_REDIRECT_URI || '',
    scope: process.env.STRAVA_SCOPE || 'activity:read'
  };
}

function readSecrets(): StravaSecrets | null {
  if (!fs.existsSync(secretFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(secretFile, 'utf8')) as StravaSecrets;
  } catch {
    return null;
  }
}

function writeSecrets(secrets: StravaSecrets) {
  fs.mkdirSync(dataDir, { recursive: true });
  const temporaryFile = `${secretFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(secrets, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryFile, secretFile);
  fs.chmodSync(secretFile, 0o600);
}

function cleanStates() {
  const currentTime = Date.now();
  for (const [state, expiry] of temporaryStates) if (expiry < currentTime) temporaryStates.delete(state);
}

export function stravaStatus() {
  const config = configuration();
  const secrets = readSecrets();
  return {
    configured: Boolean(config.clientId && config.clientSecret && config.redirectUri),
    connected: Boolean(secrets?.refreshToken),
    athleteId: secrets?.athleteId,
    expiresAt: secrets?.expiresAt,
    scope: secrets?.scope || config.scope,
    redirectUri: config.redirectUri || undefined
  };
}

export function createStravaAuthorizationUrl(): string {
  const config = configuration();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) throw new Error('strava_not_configured');
  cleanStates();
  const state = randomBytes(24).toString('hex');
  temporaryStates.set(state, Date.now() + 10 * 60 * 1000);
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: config.scope,
    state
  });
  return `https://www.strava.com/oauth/authorize?${query.toString()}`;
}

async function exchangeToken(fields: Record<string, string>): Promise<StravaTokenResponse> {
  const config = configuration();
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields })
  });
  if (!response.ok) throw new Error(`strava_token_exchange_failed_${response.status}`);
  return await response.json() as StravaTokenResponse;
}

export async function completeStravaAuthorization(code: string, state: string, scope?: string): Promise<void> {
  cleanStates();
  const expiry = temporaryStates.get(state);
  if (!expiry || expiry < Date.now()) throw new Error('invalid_or_expired_oauth_state');
  temporaryStates.delete(state);
  const token = await exchangeToken({ code, grant_type: 'authorization_code' });
  writeSecrets({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at,
    athleteId: token.athlete?.id,
    scope: scope || configuration().scope,
    updatedAt: new Date().toISOString()
  });
}

async function validAccessToken(): Promise<string> {
  const secrets = readSecrets();
  if (!secrets) throw new Error('strava_not_connected');
  if (secrets.expiresAt > Math.floor(Date.now() / 1000) + 300) return secrets.accessToken;
  const refreshed = await exchangeToken({ grant_type: 'refresh_token', refresh_token: secrets.refreshToken });
  writeSecrets({
    ...secrets,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at,
    updatedAt: new Date().toISOString()
  });
  return refreshed.access_token;
}

export function estimateStravaCalories(activity: Pick<StravaActivity, 'type' | 'sport_type' | 'moving_time' | 'elapsed_time' | 'distance' | 'calories' | 'kilojoules'>, weightKg: number): number {
  if (activity.calories && activity.calories > 0) return Math.round(activity.calories);
  if (activity.kilojoules && activity.kilojoules > 0) return Math.round(activity.kilojoules);
  const type = String(activity.sport_type || activity.type || '').toLowerCase();
  const hours = Math.max(0, Number(activity.moving_time || activity.elapsed_time || 0)) / 3600;
  if (type.includes('run') && activity.distance) return Math.round(weightKg * activity.distance / 1000);
  const met = type.includes('walk') || type.includes('hike') ? 3.8
    : type.includes('ride') || type.includes('cycle') ? 8
      : type.includes('swim') ? 8
        : type.includes('weight') || type.includes('strength') ? 6
          : 5;
  return Math.round(met * weightKg * hours);
}

export async function fetchStravaActivities(afterDate: string, weightKg: number): Promise<ActivityEntry[]> {
  const accessToken = await validAccessToken();
  const after = Math.floor(new Date(`${afterDate}T00:00:00Z`).getTime() / 1000);
  const activities: StravaActivity[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const query = new URLSearchParams({ after: String(after), page: String(page), per_page: '100' });
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?${query.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`strava_activities_failed_${response.status}`);
    const batch = await response.json() as StravaActivity[];
    activities.push(...batch);
    if (batch.length < 100) break;
  }
  return activities.map((activity) => ({
    id: `strava_${activity.id}`,
    date: activity.start_date_local.slice(0, 10),
    name: activity.name,
    source: 'strava',
    type: activity.sport_type || activity.type || 'activity',
    durationMinutes: Math.max(1, Math.round(Number(activity.moving_time || activity.elapsed_time || 0) / 60)),
    distanceMeters: activity.distance && activity.distance > 0 ? activity.distance : undefined,
    caloriesEstimated: estimateStravaCalories(activity, weightKg),
    createdAt: new Date().toISOString()
  }));
}
