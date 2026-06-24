// Lightweight HTTP polling hook for hover card property values.
// Uses the app's configured axios instance (apiClient) for consistency
// with auth headers, baseURL resolution, and interceptor pipeline.
//
// AbortController is created fresh on each effect run so that
// React 18 Strict Mode's mount→unmount→remount cycle doesn't
// leave the hook with a permanently-aborted signal.

import { useState, useEffect, useRef } from "react";
import apiClient from "@/services/http/httpClient";

interface UseHttpPollingOptions {
  /** Full URL to poll (may be absolute or relative) */
  url: string;
  /** Polling interval in ms (typically 500) */
  interval: number;
  /** When false, polling stops and state resets */
  enabled: boolean;
}

interface UseHttpPollingResult {
  /** Parsed JSON value, or null if not yet loaded */
  value: unknown;
  /** Human-readable error message, or null */
  error: string | null;
  /** True while the first fetch is in-flight */
  loading: boolean;
}

export function useHttpPolling({
  url,
  interval,
  enabled,
}: UseHttpPollingOptions): UseHttpPollingResult {
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset when disabled or url is empty
    if (!enabled || !url) {
      setValue(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let active = true;

    // Create a fresh AbortController each time the effect runs.
    // This correctly handles React 18 Strict Mode's mount→unmount→remount
    // cycle: the cleanup aborts the old controller, and the remount
    // creates a brand-new one.
    const abortController = new AbortController();

    const doFetch = async () => {
      if (!active || abortController.signal.aborted) return;

      try {
        const response = await apiClient.get(url, {
          signal: abortController.signal,
        });
        if (!active) return;

        setValue(response.data);
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (!active) return;
        // Aborted requests (via AbortController) are intentional
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Axios CanceledError from signal abortion
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as any).code === "ERR_CANCELED"
        )
          return;
        setError("加载失败");
        setLoading(false);
      }
    };

    // Fire immediately, then poll at interval
    doFetch();
    intervalRef.current = setInterval(doFetch, interval);

    return () => {
      active = false;
      abortController.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [url, interval, enabled]);

  return { value, error, loading };
}
