# Food, ingredient, and recipe data strategy

## Implemented source order

1. Local saved foods and recipes: instant, offline, and user-correctable.
2. Bundled staples: common ingredients plus Pakistani/South Asian foods guarantee useful search results even when the PC is unavailable.
3. Open Food Facts: global packaged products, barcodes, ingredients, and label nutrition without an API key.
4. USDA FoodData Central: generic foods and ingredients. The agent uses the official `DEMO_KEY` for low-volume testing and a private `USDA_API_KEY` for routine use.
5. Codex resolver: optional fallback for regional dishes and unusual packet descriptions, always requiring confirmation.

The local cache remains the product library. Online records are copied into local data only after they are selected, so frequently used foods remain available offline.

## Research decisions

- FoodData Central is public-domain/CC0 and exposes search/details APIs. Its demo key permits 30 requests per hour and 50 per day; a free private data.gov key permits the normal 1,000 requests per hour. It also publishes Foundation, SR Legacy, FNDDS, and branded datasets as JSON/CSV for a later bulk-index phase.
- Open Food Facts is a free, open, worldwide packaged-food database containing millions of products. It is the first choice for barcodes and packet labels, not the canonical source for generic cooked ingredients.
- RecipeDB reports 118,171 recipes and 23,548 ingredients with nutrition and regional metadata. It is valuable for research, but this project will not scrape or redistribute it until a stable API and the required reuse license are confirmed.
- Recipe nutrition in this app is therefore calculated from selected ingredient records, quantities, servings, and optional cooked batch weight. This is more auditable than importing an unexplained recipe total.

## Accuracy policy

- Every record keeps its source and confidence.
- Bundled records are clearly tagged as estimates and are intended as usable defaults, not laboratory truth.
- Packaged-food labels win over generic database estimates for that exact package.
- Users confirm AI suggestions and can save corrected foods locally.
- Calories/macros are normalized per 100 g and converted through explicit serving weights.

## Sources

- https://fdc.nal.usda.gov/api-guide/
- https://fdc.nal.usda.gov/download-datasets/
- https://openfoodfacts.github.io/documentation/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7687679/

