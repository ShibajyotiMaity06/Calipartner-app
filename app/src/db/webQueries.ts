import type { WebTables } from './webStorage';
type Row = Record<string, unknown>;
// The web mirror handles these existing service statements without dropping writes or duplicating rows.
export const mirroredTable =
  /\b(?:local_chat_\w+|local_workout\w*|local_food_entries|outbox|sync_cursors)\b/i;

function literal(value: string, row: Row): unknown {
  const text = value.trim();
  if (text.startsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  if (/^null$/i.test(text)) return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return row[text.replace(/^\w+\./, '')];
}

function predicate(
  expression: string,
  parameters: unknown[],
  tables: WebTables,
): (row: Row) => boolean {
  let index = 0;
  const tokens = expression.match(/'(?:''|[^'])*'|>=|<=|<>|!=|[()?=<>]|[\w.]+|,/g) ?? [];
  let position = 0;
  type Eval = (row: Row) => unknown;
  const operand = (): Eval => {
    const token = tokens[position++] ?? '';
    if (token === '?') {
      const value = parameters[index++];
      return () => value;
    }
    return (row) => literal(token, row);
  };
  const atom = (): Eval => {
    if (tokens[position] === '(') {
      position++;
      const result = or();
      position++;
      return result;
    }
    const left = operand(),
      op = tokens[position++]?.toLowerCase();
    if (op === 'is') {
      const not = tokens[position]?.toLowerCase() === 'not';
      if (not) position++;
      position++;
      return (row) => (not ? left(row) != null : left(row) == null);
    }
    if (op === 'in') {
      position++;
      const start = position;
      let depth = 0;
      while (position < tokens.length && !(tokens[position] === ')' && depth === 0)) {
        if (tokens[position] === '(') depth++;
        if (tokens[position] === ')') depth--;
        position++;
      }
      const sub = tokens.slice(start, position).join(' ');
      const count = tokens.slice(start, position).filter((token) => token === '?').length;
      const values = /^select/i.test(sub)
        ? selectRows(tables, sub, parameters.slice(index, index + count))
        : sub.split(',').map((value) => ({
            id: value.trim() === '?' ? parameters[index++] : literal(value, {}),
          }));
      if (/^select/i.test(sub)) index += count;
      position++;
      const column = sub.match(/^select\s+(\w+)/i)?.[1] ?? 'id';
      return (row) => values.some((value) => value[column] === left(row));
    }
    const right = operand();
    return (row) => {
      const a = left(row),
        b = right(row);
      switch (op) {
        case '=':
          return a === b;
        case '!=':
        case '<>':
          return a !== b;
        case '<':
          return a != null && b != null && a < b;
        case '>':
          return a != null && b != null && a > b;
        case '<=':
          return a != null && b != null && a <= b;
        case '>=':
          return a != null && b != null && a >= b;
        default:
          throw new Error(`Unsupported web predicate: ${expression}`);
      }
    };
  };
  const and = (): Eval => {
    let result = atom();
    while (tokens[position]?.toLowerCase() === 'and') {
      position++;
      const a = result,
        b = atom();
      result = (row) => a(row) && b(row);
    }
    return result;
  };
  const or = (): Eval => {
    let result = and();
    while (tokens[position]?.toLowerCase() === 'or') {
      position++;
      const a = result,
        b = and();
      result = (row) => a(row) || b(row);
    }
    return result;
  };
  const result = or();
  return (row) => Boolean(result(row));
}

export function selectRows(tables: WebTables, sql: string, parameters: unknown[]): Row[] {
  const table = sql.match(/from\s+(\w+)/i)?.[1];
  if (!table) throw new Error(`Unsupported web query: ${sql}`);
  const where = sql.match(/where\s+([\s\S]*?)(?:\s+order by|\s+group by|\s+limit|$)/i)?.[1];
  let rows = [...(tables[table] ?? [])].filter(
    where ? predicate(where, parameters, tables) : () => true,
  );
  const max = sql.match(/max\((\w+)\)\s+as\s+(\w+)/i);
  if (max)
    return [
      { [max[2]!]: rows.length ? Math.max(...rows.map((row) => Number(row[max[1]!]))) : null },
    ];
  const count = sql.match(/count\(\*\)\s+as\s+(\w+)/i);
  if (count) {
    const group = sql.match(/group by\s+(\w+)/i)?.[1];
    if (!group) return [{ [count[1]!]: rows.length }];
    const grouped = new Map<unknown, number>();
    for (const row of rows) grouped.set(row[group], (grouped.get(row[group]) ?? 0) + 1);
    return [...grouped].map(([key, value]) => ({ [group]: key, [count[1]!]: value }));
  }
  const order = sql.match(/order by\s+([\s\S]*?)(?:\s+limit|$)/i)?.[1];
  if (order)
    rows.sort((a, b) => {
      for (const field of order.split(',')) {
        const [key, direction] = field.trim().split(/\s+/);
        const left = a[key!],
          right = b[key!];
        const compared =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left ?? '') === String(right ?? '')
              ? 0
              : String(left ?? '') < String(right ?? '')
                ? -1
                : 1;
        if (compared) return direction?.toLowerCase() === 'desc' ? -compared : compared;
      }
      return 0;
    });
  const limit = sql.match(/limit\s+(\?|\d+)/i)?.[1];
  if (limit) {
    const offset = /offset\s+\?/i.test(sql) ? Number(parameters.at(-1)) : 0;
    const size =
      limit === '?'
        ? Number(
            parameters[/offset\s+\?/i.test(sql) ? parameters.length - 2 : parameters.length - 1],
          )
        : Number(limit);
    rows = rows.slice(offset, offset + size);
  }
  return rows;
}

export function mutateRows(tables: WebTables, sql: string, parameters: unknown[]): number {
  const table = sql.match(/^(?:update|delete from)\s+(\w+)/i)?.[1];
  if (!table) throw new Error(`Unsupported web mutation: ${sql}`);
  let index = 0;
  const assignments = sql.match(/set\s+([\s\S]*?)\s+where/i)?.[1]?.split(',') ?? [];
  const updates = assignments.map((assignment) => {
    const [column, raw] = assignment.split('=').map((part) => part.trim());
    const value = raw === '?' ? parameters[index++] : undefined;
    return { column: column!, raw: raw!, value };
  });
  const where = sql.match(/where\s+([\s\S]*?);?$/i)?.[1];
  const matches = where ? predicate(where, parameters.slice(index), tables) : () => true;
  const rows = tables[table] ?? [];
  const changed = rows.filter(matches);
  if (/^delete/i.test(sql)) tables[table] = rows.filter((row) => !matches(row));
  else
    for (const row of changed)
      for (const update of updates) {
        const increment = update.raw.match(/^(\w+)\s*\+\s*(\d+)$/);
        row[update.column] =
          update.raw === '?'
            ? update.value
            : increment
              ? Number(row[increment[1]!] ?? 0) + Number(increment[2])
              : literal(update.raw, row);
      }
  return changed.length;
}
