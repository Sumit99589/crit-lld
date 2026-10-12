import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { createApp } from "./http/app.js";
import { openDatabase } from "./infra/database.js";
import { consoleLogger as logger } from "./infra/logger.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const container = createContainer({ db, config, logger });
container.start();

const server = createApp(container, logger, config.staticDir).listen(config.port, () => {
  logger.info("server started", {
    port: config.port,
    ai: container.aiEnabled ? container.aiModel : "off (rules-only feedback)",
  });
});

function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  container.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Evaluations still running are safe to abandon: their lease expires and
  // recovery re-queues them on the next start.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
