// Cursor-based pagination — deliberately not offset/limit-SQL-shaped,
// so it works the same whether the storage engine is SQLite, Postgres,
// or anything else.

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}
