/**
 * 统一日志系统 — 基于 loglevel 封装
 *
 * 特性：
 * - 编译时由 VITE_LOG_LEVEL 控制默认级别（trace | debug | info | warn | error | silent）
 * - 生产环境默认 error，开发环境默认 debug
 * - 每个模块调用 createLogger(name) 获取带前缀的 Logger 实例
 */

import log, { type LogLevelDesc } from "loglevel";

// ==========================================
// 级别常量
// ==========================================
export const LOG_LEVELS: Record<string, LogLevelDesc> = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  SILENT: "silent",
} as const;

// ==========================================
// 初始化全局日志级别
// ==========================================
function resolveDefaultLevel(): LogLevelDesc {
  // 1. 环境变量显式设定（编译时注入）
  const envLevel = (import.meta as any).env?.VITE_LOG_LEVEL as string | undefined;
  if (envLevel && Object.values(LOG_LEVELS).includes(envLevel as LogLevelDesc)) {
    return envLevel as LogLevelDesc;
  }
  // 2. 开发模式默认 debug，生产模式默认 error
  return import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
}

const defaultLevel = resolveDefaultLevel();
log.setDefaultLevel(defaultLevel);

// 启动时告知当前日志级别（自身也走 loglevel）
const bootLogger = log.getLogger("Logger");
bootLogger.info(`日志系统已就绪，当前级别: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === defaultLevel)}`);

// ==========================================
// 模块 Logger 工厂
// ==========================================
export interface ModuleLogger {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * 创建带模块前缀的 Logger。
 * 用法：`const log = createLogger('HTTP'); log.info('request sent'); // → [HTTP] request sent`
 */
export function createLogger(name: string): ModuleLogger {
  const logger = log.getLogger(name);

  return {
    trace(...args: unknown[]) {
      logger.trace(`[${name}]`, ...args);
    },
    debug(...args: unknown[]) {
      logger.debug(`[${name}]`, ...args);
    },
    info(...args: unknown[]) {
      logger.info(`[${name}]`, ...args);
    },
    warn(...args: unknown[]) {
      logger.warn(`[${name}]`, ...args);
    },
    error(...args: unknown[]) {
      logger.error(`[${name}]`, ...args);
    },
  };
}
