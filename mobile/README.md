# FitnessMacro mobile app

Expo SDK 57 / React Native 0.86 local-first nutrition journal.

- `Today`: targets, macro split, meal diary, one daily weight, and activity.
- `Plans`: reusable food plans and an evidence-informed, AI-personalized meal structure.
- `Trends`: adherence, logging, activity, macro, and weight trends.
- `Food`: recent foods, personal cookbook, reference search/barcode lookup, voice phrase preview, and recipes.
- `You`: profile, themes, local PIN, Health Connect, AI status, and backup/restore.

The APK calls the private HTTPS relay directly for Groq Whisper and GPT-OSS. It never connects to a PC and never asks the owner to enter an AI key. The diary remains on the device.

Run local checks with:

```powershell
npm run typecheck
npm test
```

See [standalone testing](../docs/standalone-testing.md) for installing the preview APK.
