# Food data and recipe provenance

FitnessMacro uses a layered, no-subscription food-data strategy.

1. **Personal cookbook first.** A saved food or recipe is reused with its own nutrition. An AI estimate never silently changes it.
2. **Reference ingredients second.** The on-device starter catalog, the optional local USDA index, and USDA FoodData Central support ingredient-level lookups. The project is designed to add ingredient coverage from the free [Indian Food Composition Tables 2017](https://www.nin.res.in/ebooks/IFCT2017.pdf), which includes regional names and is a better fit for South Asian ingredients than a generic recipe API.
3. **New dishes are transparent estimates.** If no saved dish is found, Groq can suggest a decomposed ingredient recipe. It is stored as `AI estimate`, not as verified or approved. The user confirms before it is saved or logged.
4. **Attribution before web recipes.** The optional [Recipe Context Protocol](https://recipecontextprotocol.com/about) is a zero-key recipe reference with recipe-level licenses. Its Wikibooks recipes are CC BY-SA 4.0, so any integration must save and show the source URL, attribution, and license. It must not copy recipe text without meeting that licence. RecipeDB is deliberately not embedded because its CC BY-NC-SA licence would constrain a future commercial product.

The app therefore records recipe provenance as **Personal recipe**, **AI estimate**, or **Reviewed reference**. Only a specifically reviewed, attributed reference may receive the final label. This protects the diary from a model changing a known dish merely because a generic web result disagrees.

The local cache remains the practical product library. Online records are copied into local data only after selection, so frequently used foods continue to work while the PC or internet is unavailable.

## Source notes and accuracy policy

- [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) is used for generic ingredients. Its `DEMO_KEY` is suitable only for low-volume development; a free private data.gov key provides the normal higher rate limit when needed.
- [Open Food Facts](https://openfoodfacts.github.io/documentation/) is the no-key source for barcodes and exact packaged-food labels. A package label wins over a generic estimate for that specific product.
- Food records keep their source and confidence. Bundled records are tagged as estimates; recipe nutrition is calculated from selected ingredients, quantity, servings, and optional cooked batch weight rather than an unexplained total.
- All AI suggestions are confirmation-gated. Users can correct a food or recipe locally, and the saved correction is reused in preference to a new estimate.

## South Asian expansion plan

The next catalog import should be ingredient-first: IFCT/USDA-normalized rice, atta, lentils (including mash/urad), vegetables, oils, dairy, meats, and common packaged foods. Dishes such as aloo keema and mash ki dal should be saved as recipes built from those ingredients, because their oil, meat ratio, and portion size vary materially between households.
