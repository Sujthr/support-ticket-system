import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 4-level categorized logger.
 *
 * LOW    — trace-ish diagnostics, happy-path events
 * MEDIUM — business events (ticket created, webhook received, external API called)
 * HIGH   — security / integrity events (failed auth, validation rejected upload,
 *          rate-limit hit, DB constraint violation)
 * FATAL  — unrecoverable: DB down, required env missing, uncaught exception
 *
 * Emits to stdout/stderr with color-less, grep-friendly prefixes, and appends
 * JSON lines to `<cwd>/logs/app.log` for post-hoc inspection. Wraps NestJS
 * LoggerService so `app.useLogger(...)` picks it up for framework-level logs too.
 */

export type LogCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'FATAL';

const LEVEL_RANK: Record<LogCategory, number> = { LOW: 10, MEDIUM: 20, HIGH: 30, FATAL: 40 };

@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private readonly logDir: string;
  private readonly logFile: string;
  private readonly minLevel: number;
  private readonly fileEnabled: boolean;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'app.log');
    const configured = (process.env.LOG_LEVEL || 'LOW').toUpperCase() as LogCategory;
    this.minLevel = LEVEL_RANK[configured] ?? LEVEL_RANK.LOW;
    this.fileEnabled = process.env.LOG_TO_FILE !== 'false';
    if (this.fileEnabled) {
      try {
        if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
      } catch {
        // Best-effort; fall back to stdout only.
      }
    }
  }

  // ── primary API ─────────────────────────────────────────────
  low(message: string, context?: string, meta?: Record<string, unknown>) {
    this.emit('LOW', message, context, meta);
  }
  medium(message: string, context?: string, meta?: Record<string, unknown>) {
    this.emit('MEDIUM', message, context, meta);
  }
  high(message: string, context?: string, meta?: Record<string, unknown>) {
    this.emit('HIGH', message, context, meta);
  }
  fatal(message: string, context?: string, meta?: Record<string, unknown>) {
    this.emit('FATAL', message, context, meta);
  }

  // ── NestJS LoggerService adapter ────────────────────────────
  log(message: any, context?: string)     { this.emit('LOW', String(message), context); }
  error(message: any, trace?: string, context?: string) {
    this.emit('HIGH', String(message), context, trace ? { trace } : undefined);
  }
  warn(message: any, context?: string)    { this.emit('MEDIUM', String(message), context); }
  debug(message: any, context?: string)   { this.emit('LOW', String(message), context); }
  verbose(message: any, context?: string) { this.emit('LOW', String(message), context); }

  // ── internals ───────────────────────────────────────────────
  private emit(level: LogCategory, message: string, context?: string, meta?: Record<string, unknown>) {
    if (LEVEL_RANK[level] < this.minLevel) return;

    const ts = new Date().toISOString();
    const ctx = context ?? '-';
    const metaStr = meta && Object.keys(meta).length ? ' ' + safeJson(meta) : '';
    const line = `${ts} [${level}] [${ctx}] ${message}${metaStr}`;

    if (level === 'FATAL' || level === 'HIGH') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }

    if (this.fileEnabled) {
      try {
        fs.appendFileSync(
          this.logFile,
          JSON.stringify({ ts, level, context: ctx, message, ...(meta ?? {}) }) + '\n',
        );
      } catch {
        // Silently drop — never let logging errors cascade.
      }
    }
  }
}

function safeJson(o: unknown): string {
  try { return JSON.stringify(o); } catch { return '[unserializable]'; }
}
