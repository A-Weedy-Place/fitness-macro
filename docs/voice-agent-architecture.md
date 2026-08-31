# Voice architecture

## Current production flow

1. The Android app records temporary audio after the owner taps its compact microphone button.
2. The APK sends that audio by HTTPS to the private FitnessMacro Cloudflare Worker.
3. The Worker uses its server-side Groq credential to call `whisper-large-v3-turbo` and returns only the transcript.
4. The app places the transcript into its editable text field. Nothing is sent to the reasoning model and no food is logged at this point.
5. The owner deliberately edits the text and taps **Search**, **Ask AI**, or **Send**. Only those actions may call the GPT-OSS food agent.
6. Any action plan remains a proposal until the owner taps **Apply**. The app writes approved changes to its own local database.

## Privacy and product boundary

- The runtime path is `APK → private HTTPS relay → Groq`; there is no PC, LAN address, paired local agent, Codex CLI, or on-device Whisper model.
- The Worker stores no raw audio, transcript, diary, profile, or recipe data. The app does not retain raw audio after transcription.
- The APK has no Groq API key. The Worker owns the encrypted server-side secret; an APK-only relay token is a rotatable private-preview safeguard, not public-release authentication.

## Design rule

Speech capture is an input method, not an autonomous command. It must remain compact, editable, and confirmation-gated so the owner always sees what will be searched or applied.
