# Open source references for implementation patterns

## Local-first nutrition tracking
- OpenNutriTracker
  - local-first architecture
  - multiple food sources
  - straightforward sync/export boundary
- FoodYou
  - local storage and custom food workflows
  - manual correction flow

## Scanner and barcode patterns
- Waistline style
  - OFF + USDA style models
  - barcode-first enrichment + local fallback

## AI assisted workflow patterns
- Nutritheous / Fud
  - AI parsing UX
  - low-confidence confirmation screens
  - confidence badges and user feedback

## How these map to our implementation
- Keep app-side writes as source of truth.
- Use agent only for candidate expansion and cache population.
- Always require user confirmation on uncertain speech/LLM output.
