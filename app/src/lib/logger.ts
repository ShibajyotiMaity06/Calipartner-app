/* The only module allowed to use console (see eslint.config.mjs). */

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: Level = typeof __DEV__ !== 'undefined' && __DEV__ ? 'debug' : 'warn';

export function setLogLevel(level: Level): void {
  minLevel = level;
}

function emit(level: Level, scope: string, message: string, data?: unknown): void {
  if (order[level] < order[minLevel]) return;
  const line = `[${new Date().toISOString()}] [${scope}] ${message}`;
  const fn = level === 'debug' ? console.log : console[level];
  if (data === undefined) fn(line);
  else fn(line, data);
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Create a scoped logger. Never log secrets, tokens or personal health data. */
export function createLogger(scope: string): Logger {
  return {
    debug: (m, d) => emit('debug', scope, m, d),
    info: (m, d) => emit('info', scope, m, d),
    warn: (m, d) => emit('warn', scope, m, d),
    error: (m, d) => emit('error', scope, m, d),
  };
}
