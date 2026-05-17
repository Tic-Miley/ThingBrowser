import { useEffect, useRef, useState } from "react";
import { createWebSocket } from "@/services/ws/wsClient";

type SubscriptionStatus = "idle" | "connecting" | "connected" | "error";

type SubscriptionOptions<T> = {
  enabled?: boolean;
  parse?: (raw: unknown) => T | null;
};

// 指数退避重连参数
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useThingSubscription<T = unknown>(
  url?: string,
  options: SubscriptionOptions<T> = {}
) {
  const { enabled = true, parse } = options;
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const parseRef = useRef<SubscriptionOptions<T>["parse"]>(parse);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const enabledRef = useRef(enabled);
  const [pageVisible, setPageVisible] = useState(true);

  // 页面可见性监听：屏幕不在前台时暂停 WS 连接，回到前台自动恢复
  useEffect(() => {
    const onVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    parseRef.current = parse;
  }, [parse]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const effectiveEnabled = enabled && pageVisible;

  useEffect(() => {
    if (!effectiveEnabled || !url) {
      setStatus("idle");
      clearReconnect();
      closeCurrentWs();
      return;
    }

    let isMounted = true;
    setStatus("connecting");
    setError(null);

    const connect = () => {
      if (!isMounted || !enabledRef.current) return;

      const { ws, cleanup } = createWebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setStatus("connected");
        attemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(event.data);
          const next = parseRef.current
            ? parseRef.current(parsed)
            : (parsed as T);
          if (next !== null && next !== undefined) {
            setData(next);
          }
        } catch {
          setError("Failed to parse websocket payload");
        }
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setStatus("error");
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setStatus("error");

        if (enabledRef.current && document.visibilityState === "visible") {
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, attemptRef.current),
            RECONNECT_MAX_MS
          );
          attemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      return cleanup;
    };

    const cleanupFn = connect();

    return () => {
      isMounted = false;
      clearReconnect();
      closeCurrentWs();
      // 同样调用 createWebSocket 返回的 cleanup
      if (typeof cleanupFn === "function") cleanupFn();
    };
  }, [effectiveEnabled, url]);

  function closeCurrentWs() {
    const ws = wsRef.current;
    if (!ws) return;
    // 先清空回调，防止 close 触发 onclose 再次调度重连
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(); } catch { /* ignore */ }
    }
    wsRef.current = null;
  }

  function clearReconnect() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    attemptRef.current = 0;
  }

  return { data, status, error };
}
