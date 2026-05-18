import "dotenv/config";
import { run } from "@grammyjs/runner";
import { cfg, envHealth } from "./lib/config.js";
import { log, safeErr } from "./lib/log.js";

process.on("unhandledRejection", (err) => {
  log.error("process.unhandledRejection", { err: safeErr(err) });
});

process.on("uncaughtException", (err) => {
  log.error("process.uncaughtException", { err: safeErr(err) });
  process.exit(1);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPolling(bot) {
  let backoff = 2000;
  let runner = null;
  for (;;) {
    try {
      log.info("telegram.polling.prepare", {});
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      log.info("telegram.polling.start", { concurrency: 1 });
      runner = run(bot, { runner: { fetch: { allowed_updates: ["message", "callback_query"] } }, sink: { concurrency: 1 } });
      await runner.task();
      backoff = 2000;
    } catch (err) {
      const msg = safeErr(err);
      log.error("telegram.polling.failure", { err: msg, backoffMs: backoff });
      try { await runner?.stop?.(); } catch {}
      await sleep(backoff);
      backoff = Math.min(20000, Math.round(backoff * 1.7));
    }
  }
}

async function boot() {
  try {
    log.info("boot.start", { env: envHealth() });
    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is required. Add it in the Config tab or .env, then redeploy.");
      process.exit(1);
    }

    const [{ connectDb }, { createServer }, { createBot }, { registerCommands }, { startAlertScheduler }] = await Promise.all([
      import("./lib/db.js"),
      import("./features/server.js"),
      import("./bot.js"),
      import("./commands/loader.js"),
      import("./features/scheduler.js"),
    ]);

    await connectDb();

    const app = createServer();
    const server = app.listen(cfg.PORT, () => {
      log.info("http.listen", { port: cfg.PORT, dashboardUrlSet: Boolean(cfg.DASHBOARD_URL) });
    });

    const bot = createBot();
    await bot.init();
    await registerCommands(bot);
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome and dashboard buttons" },
      { command: "help", description: "Commands and risk disclaimer" },
      { command: "dashboard", description: "Open Mini App dashboard" },
      { command: "chart", description: "Open or display live chart" },
      { command: "assets", description: "Supported example assets" },
      { command: "market", description: "Current market overview" },
      { command: "signal", description: "Generate probability-based signal" },
      { command: "indicators", description: "Technical indicator readings" },
      { command: "patterns", description: "Candlestick pattern detection" },
      { command: "alerts", description: "Manage alerts" },
      { command: "journal", description: "Log demo trade" },
      { command: "risk", description: "View risk settings" },
      { command: "backtest", description: "Run strategy simulation" },
      { command: "strategies", description: "Manage strategies" },
      { command: "admin", description: "Admin panel" },
      { command: "reset", description: "Clear memory" },
    ]);

    startAlertScheduler().catch((err) => log.error("scheduler.crashed", { err: safeErr(err) }));
    await startPolling(bot);

    process.on("SIGTERM", () => server.close(() => process.exit(0)));
  } catch (err) {
    log.error("boot.failed", { code: err?.code, err: safeErr(err) });
    if (err?.code === "ERR_MODULE_NOT_FOUND") console.error("Check ESM .js imports and that all files exist.");
    process.exit(1);
  }
}

boot();
