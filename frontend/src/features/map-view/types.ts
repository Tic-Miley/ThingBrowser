// Hover card shared types
// Used by useHoverCard hook and HoverCard component

import type { ThingDescription } from "@/types/td";

/** A single property row displayed in the hover card */
export interface HoverProperty {
  /** Human-readable title, e.g. "剩余车位" or the property key if title is missing */
  title: string;
  /** Human-readable data type, e.g. "整数", "文本", "WebSocket" */
  dataType: string;
  /** Whether this property should be HTTP-polled for live values */
  isHttp: boolean;
  /** The polling URL (empty string if not HTTP) */
  href: string;
}

/** Phases of the hover card state machine */
export type HoverPhase = "idle" | "debouncing" | "fetching" | "visible" | "dismissing";

/** Complete state of the hover card at any point in time */
export interface HoverState {
  phase: HoverPhase;
  urn: string;
  /** Marker title from BBox data — available immediately before TD fetch */
  markerTitle: string;
  /** Geo position of the marker (lng, lat) */
  position: { lng: number; lat: number };
  /** Filled after successful TD fetch */
  td?: ThingDescription;
  /** Top 3 properties selected for display */
  properties?: HoverProperty[];
}
