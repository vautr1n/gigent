/**
 * Gigent Agent Runtime -- Logger
 *
 * Simple structured logger with level filtering and timestamps.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: number;
  private prefix: string;

  constructor(level: LogLevel = 'info', prefix: string = 'gigent-runtime') {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    this.prefix = prefix;
  }

  private log(level: LogLevel, message: string): void {
    if (LOG_LEVELS[level] < this.level) return;

    const timestamp = new Date().toISOString();
    const tag = level.toUpperCase().padEnd(5);
    console.log(`${timestamp} [${tag}] [${this.prefix}] ${message}`);
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  /**
   * Create a child logger with a sub-prefix.
   */
  child(subPrefix: string): Logger {
    const child = new Logger('debug', `${this.prefix}:${subPrefix}`);
    child.level = this.level;
    return child;
  }
}
