import { log, safeErr } from "../lib/log.js";
import { getCandles } from "../services/market.js";

let running = false;
let stopped = false;
let cycles = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startAlertScheduler() {
  if (running) return;
  running = true;
  stopped = false;
  log.info("polling.alerts.start", { intervalMs: 60000 });
  while (!stopped) {
    try {
      cycles += 1;
      log.info("polling.alerts.cycle", { cycle: cycles });
      await getCandles("EURUSD", "1m");
      await getCandles("BTCUSD", "5m");
      if (cycles % 1 === 0) {
        const m = process.memoryUsage();
        log.info("mem", { rssMB: Math.round(m.rss / 1e6), heapUsedMB: Math.round(m.heapUsed / 1e6) });
      }
    } catch (err) {
      log.error("polling.alerts.failure", { err: safeErr(err) });
    }
    await sleep(60000);
  }
}

export function stopAlertScheduler() {
  stopped = true;
  running = false;
}
