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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // console.log("DB created at:", await (db as any).path?.());
  return db;
}

export async function setSetting(key: string, value: string) {
  await db?.execute(`
    INSERT INTO settings (key, value) VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = $2
    `, [key, value]
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await getDB().select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

export function getDB(): Database {
  if (!db) throw new Error("DB not initialised");
  return db;
}
