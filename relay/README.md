# FitnessMacro relay

This Cloudflare Worker is a deliberately thin private relay:

- It keeps `GROQ_API_KEY` in a Cloudflare encrypted secret; the key is never shipped in the mobile app or committed.
- It accepts only the voice transcription and JSON-planning routes needed by FitnessMacro.
- Diary data stays on the device. The Worker does not persist raw audio, food logs, or profile data.
- `APP_ACCESS_TOKEN` protects this personal-test APK from casual third-party use. It is not a replacement for user authentication because an APK can be inspected. Add account authentication before public distribution.

Deploying requires two Cloudflare secrets, entered interactively:

```powershell
wrangler secret put GROQ_API_KEY
wrangler secret put APP_ACCESS_TOKEN
wrangler deploy
```

The app sends the short-lived build token in `x-fitnessmacro-app-token`; it never has access to the Groq key.
