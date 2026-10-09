/**
 * The Postgres connection (Supabase, through its transaction-mode pooler). One small pool per
 * server instance; `prepare: false` because transaction pooling can't keep prepared statements.
 * Queries are plain SQL with tagged templates (values are always parameters, never spliced).
 */
import "server-only";
import postgres from "postgres";
import { env } from "./env";

type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { saudadeSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.saudadeSql) {
    globalForDb.saudadeSql = postgres(env.databaseUrl(), {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // Supabase's pooler terminates TLS; require it.
      ssl: env.databaseUrl().includes("localhost") || env.databaseUrl().includes("127.0.0.1") ? false : "require",
      onnotice: () => {},
    });
  }
  return globalForDb.saudadeSql;
}

export type Tx = postgres.TransactionSql;

/** Run `fn` in one transaction (BEGIN … COMMIT, ROLLBACK on throw). */
export function tx<T>(fn: (t: Tx) => Promise<T>): Promise<T> {
  return sql().begin(fn) as Promise<T>;
}

/** Timestamps come back as Date; screens expect ISO strings. */
export const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : new Date(d).toISOString());
export const isoReq = (d: Date | string): string => new Date(d).toISOString();
