/**
 * Focused SQLite→PostgreSQL value conversions for the *.repository.pg.ts
 * implementations. Deliberately small and explicit — every function owns
 * ONE wire-format difference, so repository mappers stay readable and no
 * generic serialization framework hides the SQL.
 *
 * Driver facts these rely on (node-postgres defaults, never reconfigured
 * globally):
 *   - BIGINT (int8)        arrives as STRING  -> bigIntColumn()
 *   - DOUBLE PRECISION     arrives as NUMBER  -> passthrough (float8 parser)
 *   - BOOLEAN              arrives as boolean -> passthrough
 *   - TIMESTAMPTZ          arrives as Date    -> asDate() tolerates ISO text
 *   - JSONB                arrives PARSED     -> jsonbColumn() tolerates text
 *   - writing objects into jsonb: pg auto-JSON.stringify's plain objects/
 *     arrays, so domain values go over the wire WITHOUT manual stringify
 */

/** BIGINT -> number, refusing silent precision loss. */
export function bigIntColumn(value: unknown, field: string): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `PostgreSQL column '${field}' is not a safe integer: ${String(value)}`
      );
    }
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `PostgreSQL column '${field}' returned a non-numeric value: '${value}'`
      );
    }
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(
        `PostgreSQL column '${field}' exceeds Number.MAX_SAFE_INTEGER: '${value}'. Refusing to silently corrupt the metric.`
      );
    }
    return parsed;
  }
  throw new Error(
    `PostgreSQL column '${field}' has an unexpected type for a BIGINT column: ${typeof value}`
  );
}

/** Nullable BIGINT -> number | null (exact null preservation). */
export function bigIntColumnOrNull(
  value: unknown,
  field: string
): number | null {
  return value === null || value === undefined
    ? null
    : bigIntColumn(value, field);
}

/** TIMESTAMPTZ -> Date (pg delivers Date; ISO text tolerated defensively). */
export function timestampColumn(value: unknown, field: string): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `PostgreSQL column '${field}' returned an invalid timestamp: ${String(value)}`
    );
  }
  return date;
}

/**
 * JSONB -> parsed domain value. node-postgres parses jsonb already; the
 * string branch only guards exotic driver/parser configurations.
 */
export function jsonbColumn<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      throw new Error(
        `PostgreSQL JSONB column contained unparseable text: '${value.slice(0, 120)}'`
      );
    }
  }
  return value as T;
}

/** Domain value -> jsonb parameter. Null stays null; objects pass as-is
 *  (node-postgres JSON.stringify's plain objects/arrays for jsonb). */
export function jsonbParam(value: unknown): unknown {
  return value === undefined ? null : value;
}
