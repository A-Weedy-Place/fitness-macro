import json
import os
import zipfile
from pathlib import Path

import ijson

root = Path(__file__).resolve().parent.parent
archive = Path(os.getenv("USDA_SR_ARCHIVE", root / "data/usda-source/sr-legacy.zip"))
output = Path(os.getenv("USDA_LOCAL_INDEX", root / "data/usda-sr-index.json"))

def nutrient(food, number):
    for item in food.get("foodNutrients", []):
        if str(item.get("nutrient", {}).get("number", "")) == number:
            return float(item.get("amount") or 0)
    return 0.0

items = []
with zipfile.ZipFile(archive) as zipped:
    member = zipped.namelist()[0]
    with zipped.open(member) as stream:
        for food in ijson.items(stream, "SRLegacyFoods.item"):
            calories = nutrient(food, "208")
            if calories <= 0:
                continue
            category = str(food.get("foodCategory", {}).get("description") or "generic food").lower()
            food_id = str(food.get("fdcId"))
            items.append({
                "id": f"usda_sr_{food_id}",
                "name": str(food.get("description") or "USDA food"),
                "serving": {"unit": "g", "amount": 100, "gramsPerUnit": 1},
                "nutrition": {
                    "calories": calories,
                    "protein": nutrient(food, "203"),
                    "carbs": nutrient(food, "205"),
                    "fat": nutrient(food, "204"),
                    "fiber": nutrient(food, "291"),
                    "sugar": nutrient(food, "269"),
                    "sodiumMg": nutrient(food, "307"),
                },
                "tags": [category, "ingredient", "sr-legacy", "local-index"],
                "source": {"source": "usda", "rawId": food_id, "fetchedAt": "2018-04-01T00:00:00.000Z", "confidence": 0.9},
                "createdAt": "2018-04-01T00:00:00.000Z",
                "updatedAt": "2018-04-01T00:00:00.000Z",
            })

output.parent.mkdir(parents=True, exist_ok=True)
temporary = output.with_suffix(".tmp")
temporary.write_text(json.dumps(items, separators=(",", ":")), encoding="utf-8")
temporary.replace(output)
print(f"Indexed {len(items)} USDA SR Legacy foods at {output}")

