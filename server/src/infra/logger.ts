type Meta = Record<string, unknown>;

export interface Logger {
  info(message: string, meta?: Meta): void;
  warn(message: string, meta?: Meta): void;
  error(message: string, meta?: Meta): void;
}

function write(level: string, message: string, meta?: Meta) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, message, ...meta });
  (level === "error" ? console.error : console.log)(line);
}

export const consoleLogger: Logger = {
  info: (m, meta) => write("info", m, meta),
  warn: (m, meta) => write("warn", m, meta),
  error: (m, meta) => write("error", m, meta),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
