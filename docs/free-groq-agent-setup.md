# Free Groq voice and food-agent setup

This setup is for personal development with zero required API spend. It deliberately uses only Groq's Free plan inference endpoints. Paid Groq web-search tools are not used.

## 1. Create the free key

1. Sign in at <https://console.groq.com/keys>.
2. Keep the organization on the **Free** plan.
3. Do not add a payment method and do not upgrade to Developer.
4. Create an API key and copy it once.
5. In Groq Data Controls, enable Zero Data Retention if it is available for the account.

Groq currently requires a payment method only when upgrading from Free to Developer. Free limits can change, so check <https://console.groq.com/docs/rate-limits> if requests begin returning `groq_free_limit_reached`.

## 2. Configure the PC agent

From PowerShell:

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\agent
Copy-Item .env.example .env
```

Open `agent/.env` and set these values:

```dotenv
AGENT_PAIRING_TOKEN=replace-with-your-long-private-token

GROQ_API_KEY=gsk_your_private_key
GROQ_AGENT_MODEL=openai/gpt-oss-120b
APP_AGENT_PROVIDER=auto
FOOD_AGENT_PROVIDER=auto

LOCAL_TRANSCRIBE_URL=https://api.groq.com/openai
LOCAL_TRANSCRIBE_MODE=openai_compatible
LOCAL_TRANSCRIBE_MODEL=whisper-large-v3-turbo
LOCAL_TRANSCRIBE_KEY=

CODEX_FOOD_RESOLVER_ENABLED=false
CODEX_FOOD_SEARCH=false
```

`LOCAL_TRANSCRIBE_KEY` is intentionally blank: the agent safely reuses `GROQ_API_KEY` for Groq transcription. Never put `GROQ_API_KEY` in an `EXPO_PUBLIC_*` mobile variable or commit `agent/.env`.

Start the service with the Windows-friendly command that loads `.env`:

```powershell
npm install
npm run dev:env
```

Keep this terminal running while the phone uses the agent.

## 3. What stays free

- Speech-to-text: `whisper-large-v3-turbo` on Groq's Free plan.
- Food reasoning: `openai/gpt-oss-120b` on Groq's Free plan.
- Packaged foods: Open Food Facts, no key.
- Generic nutrition: local USDA index first, then USDA `DEMO_KEY` unless a free data.gov key is supplied.
- Saved foods, recipes, calculations, confirmation, and writes: local app/PC code.
- Codex CLI: disabled by this setup, but remains an optional fallback for the subscription the developer already owns.

The implementation never calls Groq Compound, Groq web search, browser search, or other metered tools. A Free account stops at its rate limit instead of using a paid capacity tier.

## 4. Token controls

The PC agent reduces each command before sending it to Groq:

- at most 24 current-day diary entries plus 8 relevant historical entries;
- at most 20 matching custom foods and 12 matching recipes;
- a 10,000-character context ceiling;
- low reasoning effort and a 2,400-token completion ceiling;
- stable system prompts placed first for Groq's automatic prompt caching;
- provider-reported input, output, and cached token counts printed in the agent terminal.

These settings can be tightened in `.env`:

```dotenv
GROQ_MAX_CONTEXT_CHARS=8000
GROQ_MAX_COMPLETION_TOKENS=1800
```

Do not raise them merely because a model has a large context window; the Free plan's per-minute token limit is the relevant constraint.

## 5. Internet recipe fallback

General web search is not enabled in this zero-cost pass because Groq's hosted search tools have separate pricing. Missing foods currently use the local catalog, local USDA index, Open Food Facts, USDA's free endpoint, and conservative model estimates with mandatory confirmation.

If broader recipe research becomes necessary, the intended no-subscription option is a self-hosted SearXNG instance. It should be added as an optional provider, never as a required dependency and never by silently using public instances.

## Open-source harness decision

Vercel AI SDK, Mastra, and LangGraph.js were evaluated. All are useful open-source projects, but a framework does not itself reduce tokens. For this bounded workflow, a small local provider layer is easier to audit and cheaper in context:

- Vercel AI SDK is the best future candidate if multi-step tool calling grows.
- Mastra is attractive for larger TypeScript workflows and resumable human approval.
- LangGraph.js is appropriate for complex state graphs and checkpointing.
- None is currently needed for one transcription followed by a confirmation-gated food plan.

The current provider boundary remains compatible with adopting one later.
