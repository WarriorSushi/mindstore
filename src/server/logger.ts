/**
 * Structured logger for MindStore.
 * 
 * In development: pretty console output
 * In production: JSON lines (parseable by log aggregators)
 * 
 * Usage:
 *   import { log } from '@/server/logger';
 *   log.info('import', 'Imported documents', { count: 42, source: 'chatgpt' });
 *   log.error('chat', 'Provider failed', { provider: 'openai', error: err.message });
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    // JSON lines for production log aggregation
    return JSON.stringify(entry);
  }
  
  // Pretty format for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[90m',  // gray
    info: '\x1b[36m',   // cyan
    warn: '\x1b[33m',   // yellow
    error: '\x1b[31m',  // red
  };
  const color = levelColors[entry.level];
  const reset = '\x1b[0m';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${color}[${entry.level.toUpperCase()}]${reset} [${entry.module}] ${entry.message}${data}`;
}

function createLogFn(level: LogLevel) {
  return (module: string, message: string, data?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      module,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    const formatted = formatEntry(entry);
    
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(formatted);
        }
        break;
      default:
        console.log(formatted);
    }
  };
}

export const log = {
  debug: createLogFn('debug'),
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
};
