import { MongoClient } from "mongodb";
import { cfg } from "./config.js";
import { log, safeErr } from "./log.js";

let client = null;
let db = null;

export async function connectDb() {
  if (!cfg.MONGODB_URI) {
    log.warn("db.disabled", { reason: "MONGODB_URI missing; using in-memory demo mode" });
    return null;
  }
  if (db) return db;
  try {
    client = new MongoClient(cfg.MONGODB_URI, { maxPoolSize: 8, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    log.info("db.connected", {});
    await ensureIndexes(db);
    return db;
  } catch (err) {
    log.error("db.connect.failed", { err: safeErr(err) });
    db = null;
    return null;
  }
}

export async function getDb() {
  return db || connectDb();
}

export async function closeDb() {
  if (client) await client.close();
  client = null;
  db = null;
}

async function ensureIndexes(database) {
  const indexes = [
    ["users", { telegramId: 1 }, { unique: true }],
    ["assets", { symbol: 1 }, { unique: true }],
    ["strategies", { telegramId: 1, name: 1 }, {}],
    ["alerts", { telegramId: 1, active: 1 }, {}],
    ["trades", { telegramId: 1, createdAt: -1 }, {}],
    ["backtests", { telegramId: 1, createdAt: -1 }, {}],
    ["signals", { telegramId: 1, createdAt: -1 }, {}],
    ["riskSettings", { telegramId: 1 }, { unique: true }],
    ["memory_messages", { platform: 1, userId: 1, chatId: 1, ts: -1 }, {}],
    ["systemEvents", { createdAt: -1 }, {}],
  ];
  for (const [collection, key, options] of indexes) {
    try {
      await database.collection(collection).createIndex(key, options);
    } catch (err) {
      log.error("db.index.failed", { collection, operation: "createIndex", err: safeErr(err) });
    }
  }
}

export async function safeInsert(collection, doc) {
  const database = await getDb();
  if (!database) return null;
  try {
    return await database.collection(collection).insertOne({ ...doc, createdAt: new Date() });
  } catch (err) {
    log.error("db.write.failed", { collection, operation: "insertOne", err: safeErr(err) });
    return null;
  }
}

export async function safeUpsert(collection, filter, mutableFields, insertOnly = {}) {
  const database = await getDb();
  if (!database) return null;
  const clean = { ...(mutableFields || {}) };
  delete clean._id;
  delete clean.createdAt;
  try {
    return await database.collection(collection).updateOne(
      filter,
      {
        $setOnInsert: { ...insertOnly, createdAt: new Date() },
        $set: { ...clean, updatedAt: new Date() },
      },
      { upsert: true },
    );
  } catch (err) {
    log.error("db.write.failed", { collection, operation: "updateOne", err: safeErr(err) });
    return null;
  }
}
