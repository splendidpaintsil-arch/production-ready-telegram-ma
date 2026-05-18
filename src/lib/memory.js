import { getDb } from "./db.js";
import { log, safeErr } from "./log.js";

const memory = [];
const COL = "memory_messages";

export async function addTurn({ platform = "telegram", userId, chatId, role, text }) {
  const doc = { platform, userId: String(userId || ""), chatId: String(chatId || ""), role, text: String(text || "").slice(0, 4000), ts: new Date() };
  const db = await getDb();
  if (!db) {
    memory.push(doc);
    while (memory.length > 500) memory.shift();
    return;
  }
  try {
    await db.collection(COL).insertOne(doc);
  } catch (err) {
    log.error("db.write.failed", { collection: COL, operation: "insertOne", err: safeErr(err) });
  }
}

export async function getRecentTurns({ platform = "telegram", userId, chatId, limit = 14 }) {
  const q = { platform, userId: String(userId || ""), chatId: String(chatId || "") };
  const db = await getDb();
  if (!db) return memory.filter((m) => m.platform === q.platform && m.userId === q.userId && m.chatId === q.chatId).slice(-limit);
  try {
    const rows = await db.collection(COL).find(q).sort({ ts: -1 }).limit(limit).toArray();
    return rows.reverse();
  } catch (err) {
    log.error("db.read.failed", { collection: COL, operation: "find", err: safeErr(err) });
    return [];
  }
}

export async function clearUserMemory({ platform = "telegram", userId, chatId }) {
  const q = { platform, userId: String(userId || ""), chatId: String(chatId || "") };
  for (let i = memory.length - 1; i >= 0; i -= 1) {
    if (memory[i].platform === q.platform && memory[i].userId === q.userId && memory[i].chatId === q.chatId) memory.splice(i, 1);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.collection(COL).deleteMany(q);
  } catch (err) {
    log.error("db.write.failed", { collection: COL, operation: "deleteMany", err: safeErr(err) });
  }
}
