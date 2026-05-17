/**
 * WebSocket 集中入口 — 与 httpClient.ts 对等的基础设施层。
 * 提供：Token 注入、环境感知 URL 构建、连接日志。
 */

import { buildFullUrl } from "@/services/http/httpClient";
import { useGlobalStore } from "@/store/useGlobalStore";
import { createLogger } from "@/services/logger";

const wsLogger = createLogger("WS");

/**
 * 构建 WebSocket URL：环境切换 + Token 注入查询参数。
 * WS 协议不支持自定义 HTTP header，Token 通过 URL 查询参数传递。
 */
export function createWsUrl(rawUrl: string): string {
  const base = buildFullUrl(rawUrl, "ws");
  const separator = base.includes("?") ? "&" : "?";
  const token = useGlobalStore.getState().token;
  return token ? `${base}${separator}token=${encodeURIComponent(token)}` : base;
}

/**
 * 创建 WebSocket 连接，返回 { ws, cleanup }。
 * 通过 addEventListener 附加基础设施日志，不与消费方的 on* 属性冲突。
 */
export function createWebSocket(
  url: string
): { ws: WebSocket; cleanup: () => void } {
  const tokenUrl = createWsUrl(url);
  wsLogger.debug(`connecting → ${tokenUrl}`);

  const ws = new WebSocket(tokenUrl);

  // 用 addEventListener 而非 on* 属性，避免被消费方覆盖
  ws.addEventListener("open", () => wsLogger.debug(`connected: ${url}`));

  ws.addEventListener("message", (event) => {
    let preview = "";
    try {
      const raw = typeof event.data === "string" ? event.data : "[binary]";
      preview = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
    } catch {
      preview = "[unreadable]";
    }
    wsLogger.debug(`← message (${url}): ${preview}`);
  });

  ws.addEventListener("close", (event) => {
    const evt = event as CloseEvent;
    wsLogger.debug(`disconnected: ${url} (code=${evt.code})`);
  });

  ws.addEventListener("error", () => {
    wsLogger.warn(`error: ${url}`);
  });

  const cleanup = () => {
    // 仅关闭已建立连接的 WS，CONNECTING 状态下的关闭会触发浏览器警告
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "client cleanup");
    }
  };

  return { ws, cleanup };
}
