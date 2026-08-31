type JsonSchema = Record<string, unknown>;

const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const string = (): JsonSchema => ({ type: 'string' });
const number = (): JsonSchema => ({ type: 'number' });

const ingredient = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'brand', 'quantity', 'unit', 'gramsPerUnit', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'confidence'],
  properties: {
    name: string(), brand: nullable(string()), quantity: number(), unit: string(), gramsPerUnit: number(),
    caloriesPer100g: number(), proteinPer100g: number(), carbsPer100g: number(), fatPer100g: number(), confidence: number()
  }
};

export const assistantPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'requiresConfirmation', 'actions', 'notes'],
  properties: {
    reply: string(),
    requiresConfirmation: { type: 'boolean' },
    actions: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['type', 'summary', 'confidence', 'targetId', 'date', 'time', 'name', 'value', 'quantity', 'servings', 'durationMinutes', 'calories', 'protein', 'carbs', 'fat', 'displayName', 'targetWeightKg', 'activityFactor', 'goalMode', 'goalIntensity', 'targetDate', 'destination', 'ingredients'],
        properties: {
          type: { type: 'string', enum: ['log_foods', 'save_food', 'create_recipe', 'create_recipe_and_log', 'log_weight', 'log_activity', 'change_entry_time', 'delete_entry', 'delete_weight', 'delete_activity', 'set_goal', 'update_profile', 'create_plan_from_day', 'apply_plan', 'delete_plan', 'navigate'] },
          summary: string(), confidence: number(), targetId: nullable(string()), date: nullable(string()), time: nullable(string()), name: nullable(string()), value: nullable(number()), quantity: nullable(number()), servings: nullable(number()), durationMinutes: nullable(number()), calories: nullable(number()), protein: nullable(number()), carbs: nullable(number()), fat: nullable(number()), displayName: nullable(string()), targetWeightKg: nullable(number()), activityFactor: nullable(number()),
          goalMode: { anyOf: [{ type: 'string', enum: ['lose', 'maintain', 'gain', 'recompose'] }, { type: 'null' }] },
          goalIntensity: { anyOf: [{ type: 'string', enum: ['gentle', 'moderate', 'aggressive'] }, { type: 'null' }] },
          targetDate: nullable(string()),
          destination: { anyOf: [{ type: 'string', enum: ['today', 'plans', 'trends', 'assistant', 'library', 'profile'] }, { type: 'null' }] },
          ingredients: { type: 'array', maxItems: 20, items: ingredient }
        }
      }
    },
    notes: { type: 'array', maxItems: 8, items: string() }
  }
};

export const foodResolutionSchema = {
  type: 'object', additionalProperties: false,
  required: ['intent', 'title', 'summary', 'dishName', 'dishServings', 'logServings', 'logDate', 'eatenAt', 'clarification', 'foods', 'notes'],
  properties: {
    intent: { type: 'string', enum: ['log_foods', 'create_recipe_and_log', 'clarify'] }, title: string(), summary: string(), dishName: nullable(string()), dishServings: number(), logServings: number(), logDate: nullable(string()), eatenAt: nullable(string()), clarification: nullable(string()),
    foods: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['existingFoodId', 'name', 'brand', 'quantity', 'unit', 'gramsPerUnit', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'confidence', 'sourceUrl'],
        properties: {
          existingFoodId: nullable(string()), name: string(), brand: nullable(string()), quantity: number(), unit: string(), gramsPerUnit: number(), caloriesPer100g: number(), proteinPer100g: number(), carbsPer100g: number(), fatPer100g: number(), confidence: number(), sourceUrl: nullable(string())
        }
      }
    },
    notes: { type: 'array', maxItems: 8, items: string() }
  }
};

export const nutritionAdviceSchema = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'actions', 'cautions', 'meals'],
  properties: {
    summary: string(), actions: { type: 'array', minItems: 2, maxItems: 6, items: string() }, cautions: { type: 'array', minItems: 1, maxItems: 4, items: string() },
    meals: {
      type: 'array', minItems: 2, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false, required: ['label', 'time', 'foods'],
        properties: { label: string(), time: string(), foods: { type: 'array', minItems: 2, maxItems: 5, items: string() } }
      }
    }
  }
};
