import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function setupDB(): Promise<Database> {
  db = await Database.load("sqlite:chats.db");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chats (
      id         INTEGER PRIMARY KEY,
      title      TEXT NOT NULL,
      model      TEXT NOT NULL,
      messages   TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  // console.log("DB created at:", await (db as any).path?.());
  return db;
}

export function getDB(): Database {
  if (!db) throw new Error("DB not initialised");
  return db;
}
