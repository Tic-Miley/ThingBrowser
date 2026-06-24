// Hover card state machine hook.
//
// State machine:
//   IDLE → (mouseenter) → DEBOUNCING → (500ms) → FETCHING → (TD loaded) → VISIBLE
//   VISIBLE → (mouseleave + 300ms grace) → DISMISSING → (150ms fade) → IDLE
//
// Any state → (mouseenter on different marker) → abort → DEBOUNCING (new)
// Any state → (click on this marker → sets activeThingUrn) → abort → IDLE

import { useState, useRef, useCallback, useEffect } from "react";
import { fetchThingTd } from "@/services/http/thingService";
import type { ThingDescription, PropertyAffordance } from "@/types/td";
import type { HoverState, HoverProperty, HoverPhase } from "./types";

// ==========================================
// Constants
// ==========================================

const DEBOUNCE_MS = 500;
const DISMISS_GRACE_MS = 300;
const DISMISS_ANIMATION_MS = 150;
const CARD_WIDTH = 240;
const CARD_HEIGHT_ESTIMATE = 160;
const GAP = 8;
const MAX_PROPERTIES = 3;

// ==========================================
// Property selection
// ==========================================

/** Map JSON Schema type to Chinese label */
const typeMap: Record<string, string> = {
  integer: "整数",
  number: "数值",
  string: "文本",
  boolean: "布尔",
  object: "对象",
  array: "数组",
};

/** Map content-type to human-readable label */
const contentTypeMap: Record<string, string> = {
  "application/json": "JSON",
  "text/html": "HTML",
  "application/pdf": "PDF",
  "video/mp4": "MP4 视频",
  "video/x-flv": "视频流",
  "text/plain": "纯文本",
};

/**
 * Resolve a human-readable data type string for a property affordance.
 * For non-JSON content types, the contentType-derived label is more
 * informative than the generic JSON Schema type (e.g. "视频流" vs "文本").
 */
function resolveDataType(prop: PropertyAffordance): string {
  const contentType = prop.forms?.[0]?.contentType;

  // For non-JSON content types, prefer the contentType label
  if (contentType && contentType !== "application/json") {
    const key = contentType.toLowerCase();
    if (contentTypeMap[key]) return contentTypeMap[key];
    return contentType;
  }

  // For JSON types (or when contentType is missing), use the type field
  if (prop.type) {
    const normalized = prop.type.toLowerCase();
    return typeMap[normalized] || prop.type;
  }

  // Last fallbacks
  if (contentType) {
    const key = contentType.toLowerCase();
    return contentTypeMap[key] || contentType;
  }
  return "未提供";
}

/**
 * Check whether a property should be treated as HTTP-pollable.
 * Only considers it HTTP if the href scheme is http(s) AND the
 * contentType is application/json (or not specified, defaulting to JSON).
 * Properties with non-JSON content types (HTML, video, PDF) are NOT
 * treated as HTTP-pollable — they show a type badge instead.
 */
function isHttpProperty(prop: PropertyAffordance): boolean {
  const form = prop.forms?.[0];
  if (!form) return false;

  const href = form.href;
  if (!href) return false;
  if (!href.startsWith("http://") && !href.startsWith("https://")) return false;

  // Only poll if the response is expected to be JSON
  const ct = form.contentType;
  if (ct && ct !== "application/json") return false;

  return true;
}

/**
 * Select up to maxCount properties from a TD's properties record.
 * HTTP-pollable properties are prioritized first, then remaining slots
 * are filled with non-HTTP properties.
 */
function selectProperties(
  properties: Record<string, PropertyAffordance> | undefined,
  maxCount = MAX_PROPERTIES,
): HoverProperty[] {
  if (!properties) return [];

  const entries = Object.entries(properties);

  // Partition: HTTP-pollable first, others second
  const httpEntries = entries.filter(([, p]) => isHttpProperty(p));
  const otherEntries = entries.filter(([, p]) => !isHttpProperty(p));

  const selected = [...httpEntries, ...otherEntries].slice(0, maxCount);

  return selected.map(([key, prop]) => ({
    title: prop.title || key,
    dataType: resolveDataType(prop),
    isHttp: isHttpProperty(prop),
    href: prop.forms?.[0]?.href || "",
  }));
}

// ==========================================
// Smart positioning
// ==========================================

interface PixelPoint {
  x: number;
  y: number;
}

interface Viewport {
  width: number;
  height: number;
}

/**
 * Compute the card's screen position relative to the map container.
 * Prefers above the marker; flips below if near the top edge.
 * Clamps horizontally within the viewport.
 */
function computeCardPosition(
  markerPixel: PixelPoint,
  viewport: Viewport,
): PixelPoint {
  // Default: center card above marker
  let cardX = markerPixel.x - CARD_WIDTH / 2;
  let cardY = markerPixel.y - CARD_HEIGHT_ESTIMATE - GAP;

  // Flip vertically if card would go above viewport
  if (cardY < 0) {
    cardY = markerPixel.y + GAP; // below marker
  }

  // Clamp horizontally within viewport (with 8px padding)
  const minX = 8;
  const maxX = viewport.width - CARD_WIDTH - 8;
  cardX = Math.max(minX, Math.min(maxX, cardX));

  return { x: cardX, y: cardY };
}

// ==========================================
// Hook options & return types
// ==========================================

interface UseHoverCardOptions {
  mapInstance: React.RefObject<any>;
  mapContainer: React.RefObject<HTMLDivElement | null>;
  activeThingUrn: string | null;
}

interface UseHoverCardReturn {
  hoverState: HoverState | null;
  hoverPosition: PixelPoint | null;
  handleMarkerEnter: (
    urn: string,
    title: string,
    position: { lng: number; lat: number },
  ) => void;
  handleMarkerLeave: () => void;
  handleCardEnter: () => void;
  handleCardLeave: () => void;
}

// ==========================================
// Hook implementation
// ==========================================

export function useHoverCard({
  mapInstance,
  mapContainer,
  activeThingUrn,
}: UseHoverCardOptions): UseHoverCardReturn {
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [hoverPosition, setHoverPosition] = useState<PixelPoint | null>(null);

  // Refs for timers and abort controllers
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tdAbortRef = useRef<AbortController | null>(null);

  // Ref bridge to avoid stale closures in event handlers
  const hoverStateRef = useRef<HoverState | null>(null);
  hoverStateRef.current = hoverState;
  const activeThingUrnRef = useRef(activeThingUrn);
  activeThingUrnRef.current = activeThingUrn;

  // ==========================================
  // Cleanup (abort all timers, fetches, polling)
  // ==========================================

  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (tdAbortRef.current) {
      tdAbortRef.current.abort();
      tdAbortRef.current = null;
    }
  }, []);

  // ==========================================
  // Screen-position computation helper
  // ==========================================

  const computeScreenPosition = useCallback(
    (lng: number, lat: number): PixelPoint | null => {
      const map = mapInstance.current;
      const container = mapContainer.current;
      if (!map || !container) return null;

      const BMapGL = (window as any).BMapGL;
      if (!BMapGL) return null;

      try {
        const point = new BMapGL.Point(lng, lat);
        const pixel = map.pointToPixel(point);
        if (!pixel) return null;

        const rect = container.getBoundingClientRect();
        return computeCardPosition(
          { x: pixel.x, y: pixel.y },
          { width: rect.width, height: rect.height },
        );
      } catch {
        return null;
      }
    },
    [mapInstance, mapContainer],
  );

  // ==========================================
  // Dismiss (start fade-out, then reset to idle)
  // ==========================================

  const startDismiss = useCallback(() => {
    setHoverState((prev) =>
      prev && prev.phase !== "dismissing"
        ? { ...prev, phase: "dismissing" }
        : prev,
    );

    setTimeout(() => {
      cleanup();
      setHoverState(null);
      setHoverPosition(null);
    }, DISMISS_ANIMATION_MS);
  }, [cleanup]);

  // ==========================================
  // Marker enter handler
  // ==========================================

  const handleMarkerEnter = useCallback(
    (
      urn: string,
      title: string,
      position: { lng: number; lat: number },
    ) => {
      // 1. Suppress if this is the currently-active (clicked) marker
      if (urn === activeThingUrnRef.current) return;

      // 2. If same marker is already in any active phase (debouncing/fetching/visible),
      //    just cancel any pending dismiss — don't restart the cycle.
      //    This handles mouseover bubbling within the marker's child elements.
      const current = hoverStateRef.current;
      if (
        current?.urn === urn &&
        current?.phase !== "idle" &&
        current?.phase !== "dismissing"
      ) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        return;
      }

      // 3. Abort everything from previous hover cycle
      cleanup();

      // 4. Enter debounce phase
      const state: HoverState = {
        phase: "debouncing",
        urn,
        markerTitle: title,
        position,
      };
      setHoverState(state);
      setHoverPosition(null);

      // 5. Start 500ms debounce timer
      debounceTimerRef.current = setTimeout(() => {
        // Transition to fetching phase
        setHoverState((prev) => {
          if (!prev || prev.urn !== urn) return prev;
          return { ...prev, phase: "fetching" };
        });

        // Compute initial position for the title-only tooltip
        const pos = computeScreenPosition(position.lng, position.lat);
        setHoverPosition(pos);

        // 6. Fetch TD
        const controller = new AbortController();
        tdAbortRef.current = controller;

        fetchThingTd(urn)
          .then((td: ThingDescription) => {
            if (controller.signal.aborted) return;

            const address = td["platform:address"];
            const properties = selectProperties(td.properties);

            setHoverState((prev) => {
              if (!prev || prev.urn !== urn) return prev;
              return {
                ...prev,
                phase: "visible",
                td,
                properties,
              };
            });

            // Recompute position (card is now larger than the tooltip)
            const updatedPos = computeScreenPosition(
              position.lng,
              position.lat,
            );
            if (updatedPos) setHoverPosition(updatedPos);
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            // TD fetch failed — still show the card with error state
            setHoverState((prev) => {
              if (!prev || prev.urn !== urn) return prev;
              return {
                ...prev,
                phase: "visible",
                td: undefined,
                properties: undefined,
              };
            });
          });
      }, DEBOUNCE_MS);
    },
    [cleanup, computeScreenPosition],
  );

  // ==========================================
  // Marker leave handler
  // ==========================================

  const handleMarkerLeave = useCallback(() => {
    // Clear any existing dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    // Start 300ms grace period before dismissing
    dismissTimerRef.current = setTimeout(() => {
      startDismiss();
    }, DISMISS_GRACE_MS);
  }, [startDismiss]);

  // ==========================================
  // Card enter handler (cancel pending dismiss)
  // ==========================================

  const handleCardEnter = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // ==========================================
  // Card leave handler (start dismiss)
  // ==========================================

  const handleCardLeave = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = setTimeout(() => {
      startDismiss();
    }, DISMISS_GRACE_MS);
  }, [startDismiss]);

  // ==========================================
  // Dismiss hover card when its marker becomes active (clicked)
  // ==========================================

  useEffect(() => {
    if (
      activeThingUrn &&
      hoverState &&
      activeThingUrn === hoverState.urn &&
      hoverState.phase !== "dismissing"
    ) {
      cleanup();
      setHoverState(null);
      setHoverPosition(null);
    }
  }, [activeThingUrn, hoverState, cleanup]);

  // ==========================================
  // Map pan/zoom → recompute position while card is visible
  // ==========================================

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !hoverState || hoverState.phase !== "visible") return;

    const updatePosition = () => {
      const pos = computeScreenPosition(
        hoverState.position.lng,
        hoverState.position.lat,
      );
      if (pos) {
        setHoverPosition(pos);
      } else {
        // Marker moved off-screen — dismiss
        startDismiss();
      }
    };

    map.addEventListener("dragend", updatePosition);
    map.addEventListener("zoomend", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      map.removeEventListener("dragend", updatePosition);
      map.removeEventListener("zoomend", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [
    mapInstance,
    hoverState?.phase,
    hoverState?.position?.lng,
    hoverState?.position?.lat,
    computeScreenPosition,
    startDismiss,
  ]);

  // ==========================================
  // Cleanup on unmount
  // ==========================================

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    hoverState,
    hoverPosition,
    handleMarkerEnter,
    handleMarkerLeave,
    handleCardEnter,
    handleCardLeave,
  };
}
