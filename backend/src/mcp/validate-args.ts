/**
 * Shared argument guard for MCP tools.
 *
 * Every tool declares an `inputSchema`; the SDK server does not enforce it, so a
 * call with missing or mistyped arguments used to reach the tool body and die
 * with a raw JS message ("Cannot read properties of undefined (reading 'trim')").
 * This checks `required`, JSON types and enums up front and returns a readable
 * message naming the offending argument instead.
 */

interface PropertySchema {
  type?: string | string[];
  enum?: readonly unknown[];
}

export interface ToolSchema {
  name: string;
  inputSchema: {
    properties?: { [key: string]: PropertySchema | undefined };
    required?: readonly string[];
  };
}

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Returns a validation message, or undefined when the arguments are acceptable.
 * Required string arguments must also be non-blank.
 */
export function validateToolArgs(tool: ToolSchema, args: unknown): string | undefined {
  if (args !== undefined && args !== null && (typeof args !== 'object' || Array.isArray(args))) {
    return `Invalid arguments for ${tool.name}: expected an object`;
  }
  const given = (args ?? {}) as Record<string, unknown>;
  const { properties = {}, required = [] } = tool.inputSchema;

  const missing = required.filter((key) => {
    const v = given[key];
    if (v === undefined) return true;
    // null is only acceptable where the schema allows it (e.g. move_page newParentGuid).
    if (v === null) return !asArray(properties[key]?.type).includes('null');
    return typeof v === 'string' && v.trim() === '' && asArray(properties[key]?.type).includes('string')
      && !asArray(properties[key]?.type).includes('null');
  });
  if (missing.length > 0) {
    return `Missing required argument${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
  }

  for (const [key, value] of Object.entries(given)) {
    const prop = properties[key];
    if (!prop || value === undefined) continue;
    const types = asArray(prop.type);
    if (types.length > 0 && !types.includes(jsonType(value))) {
      return `Invalid argument "${key}": expected ${types.join(' or ')}, got ${jsonType(value)}`;
    }
    if (prop.enum && !prop.enum.includes(value)) {
      return `Invalid argument "${key}": must be one of ${prop.enum.join(', ')}`;
    }
  }
  return undefined;
}

function asArray(t: string | string[] | undefined): string[] {
  return t === undefined ? [] : Array.isArray(t) ? t : [t];
}
