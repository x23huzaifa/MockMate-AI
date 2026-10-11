/**
 * Drizzle ORM client over a mysql2 connection pool.
 *
 * Uses ENV.DATABASE_URL, which env.ts validates at startup — the server
 * refuses to boot with a missing/invalid database URL instead of failing
 * cryptically on the first query.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "../server/_core/env.js";
import * as schema from "./schema.js";

const pool = mysql.createPool({ uri: ENV.DATABASE_URL });

export const db = drizzle(pool, { schema, mode: "default" });

export type Db = typeof db;
