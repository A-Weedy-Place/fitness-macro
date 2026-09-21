import { utf8Bytes } from '../../logic/bytes';
type JsonRecord = Record<string, unknown>;
type Checked = { value: unknown; repaired: number };
const record = (value: unknown): JsonRecord | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
const own = (value: JsonRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const keywords = new Set(['type', 'anyOf', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems']);

/** Validate every supported keyword; an expanded/unsupported schema fails closed. */
function check(value: unknown, schema: JsonRecord, depth = 0): Checked | null {
  if (depth > 16 || Object.keys(schema).some((key) => !keywords.has(key))) return null;
  if (Array.isArray(schema.anyOf)) {
    if (Object.keys(schema).length !== 1) return null;
    for (const branch of schema.anyOf) {
      const branchSchema = record(branch);
      const result = branchSchema ? check(value, branchSchema, depth + 1) : null;
      if (result) return result;
    }
    return null;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) return null;
  if (schema.type === 'null') return value === null ? { value, repaired: 0 } : null;
  if (schema.type === 'string') return typeof value === 'string' ? { value, repaired: 0 } : null;
  if (schema.type === 'boolean') return typeof value === 'boolean' ? { value, repaired: 0 } : null;
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? { value, repaired: 0 } : null;
  if (schema.type === 'array') {
    const items = record(schema.items);
    if (!Array.isArray(value) || !items || value.length > 100 || (typeof schema.minItems === 'number' && value.length < schema.minItems) || (typeof schema.maxItems === 'number' && value.length > schema.maxItems)) return null;
    const output: unknown[] = [];
    let repaired = 0;
    for (const item of value) {
      const result = check(item, items, depth + 1);
      if (!result) return null;
      output.push(result.value); repaired += result.repaired;
    }
    return { value: output, repaired };
  }
  if (schema.type === 'object') {
    const object = record(value), properties = record(schema.properties);
    if (!object || !properties || schema.additionalProperties !== false || !Array.isArray(schema.required) || schema.required.some((key) => typeof key !== 'string') || Object.keys(object).some((key) => !own(properties, key))) return null;
    const output: JsonRecord = {};
    let repaired = 0;
    for (const [key, definition] of Object.entries(properties)) {
      const property = record(definition);
      if (!property) return null;
      if (!own(object, key)) {
        if (!schema.required.includes(key)) continue;
        // Never invent non-null amounts, ingredients, actions or descriptions.
        if (!Array.isArray(property.anyOf) || !property.anyOf.some((branch) => record(branch)?.type === 'null')) return null;
        if (!check(null, property, depth + 1)) return null;
        Object.defineProperty(output, key, { value: null, enumerable: true }); repaired++;
      } else {
        const result = check(object[key], property, depth + 1);
        if (!result) return null;
        Object.defineProperty(output, key, { value: result.value, enumerable: true }); repaired += result.repaired;
      }
    }
    if (schema.required.some((key) => !own(output, key as string))) return null;
    return { value: output, repaired };
  }
  return null;
}

/** Groq occasionally omits unused nullable fields despite strict JSON mode.
 * Recover only that exact failure in memory; domain validation still runs at
 * the caller. Never log/retain failed_generation or make another model call.
 */
export function recoverNullableGeneration(status: number, payload: unknown, schema: JsonRecord): Checked | null {
  const error = record(record(payload)?.error);
  if (status !== 400 || error?.code !== 'json_validate_failed' || typeof error.failed_generation !== 'string') return null;
  const content = error.failed_generation;
  if (content.length > 32_768 || utf8Bytes(content) > 32_768) return null;
  try {
    const result = check(JSON.parse(content), schema);
    return result && result.repaired > 0 ? result : null;
  } catch {
    return null;
  }
}
