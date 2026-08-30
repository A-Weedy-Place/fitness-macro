# Implementation roadmap

## Complete testable core

- [x] Local-first daily diary with breakfast, lunch, dinner, snack, and other buckets
- [x] Date navigation, entry deletion, and ordered offline synchronization
- [x] Open Food Facts name/barcode lookup and optional USDA enrichment
- [x] Voice-phrase candidate resolution with user confirmation
- [x] Custom packet foods normalized to per-100-g nutrition
- [x] Weight logging and rolling seven-log trend
- [x] BMR, TDEE, calorie target, and macro target calculation
- [x] Manual Strava/watch activity entry
- [x] Reusable food plans saved from any logged day and applied to future days
- [x] Five-tab product UI: Today, Plans, Trends, Food, You
- [x] Calorie bars, weight/trend line graph, macro donut, consistency grid, and meal distribution
- [x] Adherence, protein-hit, streak, activity, average intake, and weight-change metrics
- [x] Automated tests for nutrition, targets, analytics, plans, schema validation, and storage
- [x] Android Metro/Hermes production export

## Next integrations

- [ ] Expo audio capture and upload consent UI
- [ ] Local Whisper-compatible transcription process on the PC
- [ ] Structured multi-food quantity extraction with candidate-level confidence
- [ ] Strava OAuth application credentials, token refresh, and polling import
- [ ] Recipe ingredients, yield, serving scaling, and derived nutrition

## Release hardening

- [ ] Move the mobile persistence layer from AsyncStorage to SQLite
- [ ] Add QR pairing and HTTPS/private-tunnel setup
- [ ] Add JSON/CSV import and restore UI
- [ ] Add camera barcode scanning
- [ ] Add EAS development build and physical iOS validation
