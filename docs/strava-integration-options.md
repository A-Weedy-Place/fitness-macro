# Strava option analysis for this project

## Can it be integrated?
Yes. Strava supports OAuth and activity read scopes suitable for personal fitness analytics.

## Minimal viable approach
- Register app in Strava developer console.
- Implement `/v1/authorize` redirect flow and token exchange.
- Store refresh token + expiry in agent secure storage.
- Polling first, with optional webhooks once stable.

## Scopes to start
- `activity:read` for basic activity feed.
- Add more scopes only if user asks for deeper integration.

## Exportable activity fields
- activity id/date
- name/type
- distance
- moving_time
- elapsed_time
- calories (if available)
- elevation_gain

## If you skip Strava
- Add manual activity import form in app:
  - activity type
  - duration
  - distance
  - subjective effort or MET class
- Convert to estimated calories with profile-specific MET factors.
- User can edit/override actual calories from daily trend.
