# Voice + LLM pipeline (offline-first friendly)

## End-to-end flow
1. Mobile records speech to AAC/wav.
2. App uploads audio to local agent endpoint `/v1/audio/transcribe` (to be added).
3. Agent runs local transcriber (Whisper.cpp/Whisper API) and gets transcript.
4. Transcript goes to `/v1/foods/resolve`.
5. App shows ranked candidates with confidence and source.
6. User confirms or edits before final persistence.

## Why not direct external APIs first
- Cost control and regional food variation support.
- No privacy leakage of raw audio and health context.
- Offline behavior for repeated meals and local foods.

## Privacy baseline
- Keep raw audio under a retention window (`14` days default).
- Optional local encryption before filesystem write.
- Keep transcripts for `24` hours only unless user explicitly keeps them.

## Immediate next code tasks
- Add local `AgentJob` table + worker queue in `agent`.
- Add transcribe endpoint + parser adapter in `agent`.
- Add `voice` screen in `mobile` to record and poll job status.
