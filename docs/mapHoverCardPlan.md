# Map Hover Card — Implementation Plan

> **Status:** Approved · **Date:** 2026-06-22 · **Branch:** `main`

## 1. Problem Statement

The map view currently displays markers (Baidu Map GL `Label` overlays). When the user clicks a marker, the details panel opens with full Thing Description data. There is no intermediate preview — the user must click and commit the right-side panel to see anything beyond a marker's title.

This feature adds a **hover card**: a compact overlay that appears when the cursor rests on a marker, showing the thing's basic info and its first three properties with live-polled values for HTTP endpoints.

---

## 2. Decisions Summary (from User Interviews)

| # | Concern | Decision |
|---|---------|----------|
| 1 | TD data fetching | **Lazy fetch on hover** — fetch full TD via `/api/v1/things/:urn` only when hover triggers |
| 2 | HTTP polling lifecycle | **Only while card is visible** — start on card appear, abort on dismiss |
| 3 | "HTTP GET" detection | **Check href scheme** — `http://` / `https://` → HTTP GET; all others → show type only |
| 4 | Card positioning | **Smart auto-flip** — prefer above marker; flip below/left/right near viewport edges |
| 5 | Hover delay (debounce) | **400–600 ms** — cursor must rest on marker before card triggers |
| 6 | Click vs. hover interaction | **Click dismisses the hover card** — click still selects the thing; hover card is mutually exclusive with click selection |
| 7 | "First three" properties | **Prioritize observable + HTTP GET** — show HTTP-pollable properties first, fill remaining slots with others |
| 8 | Security level (L1–L4) | **No filtering** — same behavior as the details panel |
| 9 | Loading state | **Immediate title-only tooltip** (from BBox data, no fetch) → expands to full card when TD arrives |
| 10 | Component strategy | **Standalone HoverCard** — built from scratch, optimized for compact form factor; does NOT reuse CardWrapper |
| 11 | Non-HTTP properties | **Type badge only** — show e.g. `WebSocket`, `整数`, `文本` next to the property title |
| 12 | Rapid hover/unhover | **Abort everything** — cancel in-flight TD fetch + all active HTTP polling for the previous marker |
| 13 | Dismiss trigger | **Mouse leaves marker AND card + 300 ms grace period** — user can move cursor onto the card to read |
| 14 | HTTP error state | **Per-property error** — show `加载失败` in red for that property row; other properties unaffected |
| 15 | Visual layout | **Compact vertical stack** — title → address → divider → up to 3 property rows (label : value/type) |
| 16 | Card width | **Fixed 240 px** — content truncated with ellipsis for overflow |
| 17 | Map rendering approach | **React portal + CSS anchored** — render HoverCard in a React portal, positioned via `map.pointToPixel()` relative to the map container |
| 18 | Active (clicked) marker | **No hover card** — suppress hover card for the currently-selected marker (details panel already shows full info) |
| 19 | Tooltip → card transition | **Expand animation** — tooltip grows downward revealing properties and address (CSS transition on max-height + opacity) |
| 20 | Dismiss animation | **Fade out 150 ms** — opacity transition before removal |

---

## 3. Architecture Overview

### 3.1 State Machine

```
                         mouseenter
  ┌──────┐    (marker)     ┌─────────────┐   500ms timer fires    ┌──────────┐
  │ IDLE │ ───────────────→│ DEBOUNCING  │ ─────────────────────→ │ FETCHING │
  └──────┘                 └─────────────┘                        └──────────┘
      ↑                          │                                      │
      │               mouseleave │ (within 500ms)              TD loaded │
      │                          ↓                                      ↓
      │                     back to IDLE                          ┌──────────┐
      │                                                           │ VISIBLE  │
      │                                                           └──────────┘
      │                                                                  │
      │                                         mouseleave marker+card   │
      │                                         + 300ms grace period     │
      │                                                                  ↓
      │                                                           ┌─────────────┐
      └──────────── 150ms fade-out complete ──────────────────── │ DISMISSING  │
                                                                  └─────────────┘

Any state ──(mouseenter on different marker)──→ abort current → DEBOUNCING (new marker)
Any state ──(click on this marker)─────────────→ abort all → IDLE (marker becomes active)
```

### 3.2 Component Tree

```
MapView.tsx
├── <div ref={mapContainer}>                    ← Baidu Map mounts here
│   └── [Baidu Map GL Labels — markers]        ← existing, unchanged
├── {errorMessage && <ErrorBanner/>}            ← existing, unchanged
└── {hoverState && createPortal(               ← NEW: React portal
        <HoverCard
            state={hoverState}
            screenPosition={hoverPosition}
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
        />,
        mapContainer.current    ← portal target: map container DOM node
    )}
```

### 3.3 New Files

```
frontend/src/features/map-view/
├── MapView.tsx              ← MODIFY: add hover event bindings, portal rendering
├── HoverCard.tsx             ← NEW: standalone HoverCard UI component
├── HoverCard.css             ← NEW: styles for expand/fade animations, layout
├── useHoverCard.ts           ← NEW: hover state machine hook
├── useHttpPolling.ts         ← NEW: lightweight HTTP polling (500ms interval)
└── types.ts                  ← NEW: shared types for hover card
```

### 3.4 Data Flow

```
┌──────────────┐     BBox API        ┌──────────────────────┐
│ MapView      │────────────────────→│ markersRef            │
│              │  {urn, location,     │ {urn → {urn, title,  │
│              │   type, title}[]     │  location, type}}     │
└──────┬───────┘                     └──────────────────────┘
       │
       │ mouseenter + 500ms debounce
       ↓
┌──────────────┐     GET /things/:urn    ┌────────────────────┐
│ useHoverCard │────────────────────────→│ ThingDescription    │
│              │                         │ { title,            │
│              │←────────────────────────│   platform:address, │
│              │                         │   properties }      │
└──────┬───────┘                         └────────────────────┘
       │
       │ parse properties, start HTTP polling
       ↓
┌────────────────┐
│ HoverCard      │
│ ┌────────────┐ │
│ │ Title       │ │  ← from BBox data (instant)
│ │ Address     │ │  ← from TD
│ │ ──────────  │ │
│ │ Prop 1: val │ │  ← HTTP polled @ 500ms OR type badge
│ │ Prop 2: val │ │
│ │ Prop 3: val │ │
│ └────────────┘ │
└────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 `types.ts` — Shared Types

```typescript
// A single property row in the hover card
interface HoverProperty {
  title: string;           // property title (or key if title missing)
  dataType: string;        // human-readable type e.g. "整数", "文本", "WebSocket"
  isHttp: boolean;         // true → poll href; false → show type badge
  href: string;            // HTTP polling URL (empty if not HTTP)
}

// State machine phases
type HoverPhase = 'idle' | 'debouncing' | 'fetching' | 'visible' | 'dismissing';

interface HoverState {
  phase: HoverPhase;
  urn: string;
  markerTitle: string;       // from BBox data — available immediately
  position: { lng: number; lat: number };  // marker geo position
  td?: ThingDescription;     // filled after fetch
  properties?: HoverProperty[];
}
```

### 4.2 `useHoverCard.ts` — State Machine Hook

**Inputs:**
- `mapInstance` — the Baidu Map GL instance (for coordinate conversion)
- `markersRef` — current marker registry (for mouse event binding)
- `activeThingUrn` — from global store (to suppress hover on active marker)

**Outputs:**
- `hoverState: HoverState | null`
- `hoverPosition: { x: number; y: number } | null` — screen coordinates for the card
- `handleCardEnter: () => void`
- `handleCardLeave: () => void`

**Internal timers & controllers (all stored in refs):**
- `debounceTimer: number` — 500ms timeout ID
- `dismissTimer: number` — 300ms grace period timeout ID
- `abortController: AbortController` — for cancelling in-flight TD fetch
- `pollingControllers: Map<string, AbortController>` — per-property polling cancellation

**Behavior per marker:**
1. **mouseenter** → if `urn === activeThingUrn` → no-op (suppress for active marker). Otherwise: clear any existing debounce/dismiss timers, abort previous fetch + polling, set phase=`debouncing`, start 500ms timer.
2. **debounce timer fires** → set phase=`fetching`, fetch TD via `fetchThingTd(urn)`, attach AbortController signal.
3. **TD fetch succeeds** → extract address, pick first 3 properties (see §4.3), set phase=`visible`.
4. **TD fetch fails** → show card with title + address + "加载失败" for properties section. Set phase=`visible`.
5. **mouseleave** (from both marker AND card) → clear any grace period timer, start 300ms dismiss timer.
6. **dismiss timer fires** → set phase=`dismissing`, after 150ms animation → set phase=`idle`, clear state, abort all polling.

**Marker event binding:**
The hook is responsible for attaching `mouseenter`/`mouseleave` listeners to each marker at creation time (in `MapView.tsx`). Since markers are Baidu Map `Label` instances, events are attached via `marker.addEventListener('mouseenter', ...)` and `marker.addEventListener('mouseleave', ...)`.

**Why a custom hook instead of react-query?**
React Query is declarative and key-based. The hover card lifecycle is imperative (abort on mouseleave, start on mouseenter, polling at 500ms not configurable via react-query's `refetchInterval` without awkward workarounds). A custom hook gives us direct control over AbortController and interval timing.

### 4.3 Property Selection Algorithm

Given `td.properties: Record<string, PropertyAffordance>`:

```
function selectProperties(properties, maxCount = 3): HoverProperty[] {
  const entries = Object.entries(properties);

  // Partition: HTTP-pollable first, others second
  const httpEntries = entries.filter(([_, p]) =>
    p.forms?.[0]?.href?.startsWith('http://') || p.forms?.[0]?.href?.startsWith('https://')
  );
  const otherEntries = entries.filter(([_, p]) =>
    !(p.forms?.[0]?.href?.startsWith('http://') || p.forms?.[0]?.href?.startsWith('https://'))
  );

  const selected = [...httpEntries, ...otherEntries].slice(0, maxCount);

  return selected.map(([key, prop]) => ({
    title: prop.title || key,
    dataType: resolveDataType(prop),
    isHttp: !!(prop.forms?.[0]?.href?.startsWith('http://') ||
               prop.forms?.[0]?.href?.startsWith('https://')),
    href: prop.forms?.[0]?.href || '',
  }));
}
```

`resolveDataType` mirrors the logic in `TDMapper.pickDataType`:
- Use `prop.type` → map to Chinese label (integer→整数, number→数值, string→文本, boolean→布尔, object→对象, array→数组)
- Fallback: `prop.forms[0].contentType` → map (application/json→JSON, text/html→HTML, video/mp4→MP4, etc.)
- Fallback: "未提供"

**Why prioritize HTTP first?**
The hover card's key value is showing live-polled data. HTTP properties can be polled instantly; WS properties require connection setup that is too heavy for a transient hover. Showing HTTP values first maximizes the chance that the user sees live data.

### 4.4 `useHttpPolling.ts` — HTTP Polling Hook

```
useHttpPolling(url: string, interval: number, enabled: boolean, signal: AbortSignal)
  → { value: any | null; error: string | null; loading: boolean }
```

**Key behaviors:**
- Uses `fetch()` (not axios) for lightweight requests — the polling is transient and doesn't need the full interceptor pipeline
- Fires immediately on `enabled` becoming true (no waiting for first interval)
- Stops when `enabled` becomes false OR `signal` is aborted
- On HTTP error (non-2xx): sets `error`, continues polling (transient failures shouldn't kill the card)
- On network error (fetch throws): sets `error`, continues polling
- The AbortSignal from `signal` is passed directly to `fetch()` — aborted requests don't count as errors

**Why not use the existing `NumberCardHTTP` wrapper?**
The existing wrapper uses react-query's `useQuery` with `refetchInterval: 5000`. For the hover card we need:
1. 500ms interval (not 5s)
2. Imperative start/stop (not declarative key-based)
3. AbortController integration (not react-query's query cancellation)
4. Lightweight — no need for caching, retry logic, or query deduplication

### 4.5 `HoverCard.tsx` — UI Component

**Props:**
```typescript
interface HoverCardProps {
  phase: HoverPhase;
  markerTitle: string;
  address?: string;
  properties?: HoverProperty[];
  screenPosition: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
```

**States:**

| Phase | Visual |
|-------|--------|
| `debouncing` | (nothing visible — waiting for debounce timer) |
| `fetching` | **Title-only tooltip**: small rounded rect showing `markerTitle` only, positioned above marker. Semi-transparent, no properties yet. |
| `visible` | **Expanded card** (240px wide): title (bold), address (muted, truncated), divider, 3 property rows. Tooltip expands downward via CSS transition on `max-height` and `opacity`. |
| `dismissing` | Card fades out (opacity 1→0, 150ms). After transition ends, component unmounts. |

**Property Row Rendering:**
- **HTTP property (isHttp=true):** Shows `<PropertyTitle>: <PolledValue/>` where `PolledValue` is a micro-component that calls `useHttpPolling`. Shows spinner while loading, value on success, "加载失败" in red on error.
- **Non-HTTP property (isHttp=false):** Shows `<PropertyTitle> <TypeBadge/>` where `TypeBadge` is a small muted badge (e.g., `[WebSocket]`, `[整数]`).

**Smart Positioning Algorithm:**
```
const CARD_WIDTH = 240;
const CARD_HEIGHT_ESTIMATE = 160; // approximate; measure real height after render
const GAP = 8; // pixels between marker and card

function computeCardPosition(
  markerScreenPos: { x: number; y: number },
  viewport: { width: number; height: number }
): { x: number; y: number; arrow: 'top' | 'bottom' } {
  // Default: center card above marker
  let cardX = markerScreenPos.x - CARD_WIDTH / 2;
  let cardY = markerScreenPos.y - CARD_HEIGHT_ESTIMATE - GAP;
  let arrow: 'top' | 'bottom' = 'bottom'; // arrow points down toward marker

  // Flip vertically if card would go above viewport
  if (cardY < 0) {
    cardY = markerScreenPos.y + GAP; // below marker
    arrow = 'top'; // arrow points up
  }

  // Clamp horizontally within viewport (with 8px padding)
  const minX = 8;
  const maxX = viewport.width - CARD_WIDTH - 8;
  cardX = Math.max(minX, Math.min(maxX, cardX));

  return { x: cardX, y: cardY, arrow };
}
```

**Note on Baidu Map coordinate conversion:**
The marker's geo position (lng, lat) must be converted to screen coordinates using `mapInstance.pointToPixel(point)`. This returns pixel coordinates relative to the map container. We'll read these in `useHoverCard` and pass to `HoverCard` as `screenPosition`.

### 4.6 CSS Animation Details

```css
/* Title-only tooltip state */
.hover-card-tooltip {
  max-height: 40px;
  opacity: 0.95;
  transition: max-height 250ms ease-out, opacity 200ms ease-out;
}

/* Expanded card state */
.hover-card-expanded {
  max-height: 300px;  /* enough for title + address + divider + 3 rows */
  opacity: 1;
  transition: max-height 300ms ease-in-out, opacity 200ms ease-out;
}

/* Dismissing */
.hover-card-dismissing {
  opacity: 0;
  transition: opacity 150ms ease-in;
  pointer-events: none;
}
```

The expand effect is achieved by rendering the full content inside a container whose `max-height` animates from tooltip size to card size, with `overflow: hidden`.

---

## 5. MapView.tsx Changes

### 5.1 New Imports

```typescript
import { createPortal } from "react-dom";
import { HoverCard } from "./HoverCard";
import { useHoverCard } from "./useHoverCard";
```

### 5.2 Hook Integration

Inside `MapView` component, after existing hooks:

```typescript
const { hoverState, hoverPosition, handleCardEnter, handleCardLeave } =
  useHoverCard({
    mapInstance,
    markersRef,
    activeThingUrn,
  });
```

### 5.3 Marker Event Binding

In `actualFetchAndRender`, when creating new markers (the `items.forEach` block), add:

```typescript
// After existing click event listener:
marker.addEventListener('mouseenter', () => {
  handleMarkerEnter(markerData.urn, markerData.title, position);
});
marker.addEventListener('mouseleave', () => {
  handleMarkerLeave();
});
```

`handleMarkerEnter` and `handleMarkerLeave` are stable callbacks (via `useCallback` or refs) that delegate to `useHoverCard` internals.

### 5.4 Portal Rendering

After the existing `errorMessage` block in the JSX:

```typescript
{hoverState && hoverPosition && mapContainer.current && createPortal(
  <HoverCard
    phase={hoverState.phase}
    markerTitle={hoverState.markerTitle}
    address={hoverState.td?.['platform:address']}
    properties={hoverState.properties}
    screenPosition={hoverPosition}
    onMouseEnter={handleCardEnter}
    onMouseLeave={handleCardLeave}
  />,
  mapContainer.current
)}
```

**Why portal into `mapContainer.current` instead of `document.body`?**
Positioning is relative to the map container's coordinate system. `mapInstance.pointToPixel()` returns coordinates in that space. Portal-ing directly into the map container means we can use those coordinates directly without offset math.

### 5.5 Active Marker Suppression

In `useHoverCard`, the `handleMarkerEnter` function checks:

```typescript
if (urn === activeThingUrnRef.current) {
  return; // no-op: suppress hover card for active marker
}
```

---

## 6. Edge Cases & Robustness

### 6.1 No Properties
If TD has zero properties → card still shows title + address. The divider and properties section are omitted. Card is shorter.

### 6.2 Missing Address
If `platform:address` is absent → card shows title only, no address line. Slightly more compact.

### 6.3 Malformed Forms
If a property has `forms: []` (empty array) or missing `forms` entirely → treat as non-HTTP, show data type from `property.type` or "未提供".

### 6.4 Property with Both HTTP and WS Forms
If a property has multiple forms (e.g., one HTTP GET, one WS observe) → `forms[0]` is used for detection. If `forms[0].href` is HTTP → treat as HTTP. This is consistent with the existing `CardWrapper` behavior.

### 6.5 Map Pan/Zoom While Card Visible
If the user pans or zooms the map while a hover card is visible:
- The card's position becomes stale (marker moves on screen)
- Solution: subscribe to `dragend`/`zoomend` events → if hover card is visible, recompute screen position from marker's lng/lat. If marker moves off-screen, dismiss the card.

### 6.6 Window Resize
If the browser window resizes → recompute card position. Listen via `window.addEventListener('resize', ...)` inside `useHoverCard`.

### 6.7 HTTP Polling with 500ms vs Backend Rate
500ms polling is aggressive. The backend mock endpoints (`/proxy/things/:urn/properties/*`) have no rate limiting currently, but in production this would generate 2 requests/second per visible property. Mitigations:
- A comment in the code should note this tradeoff
- Future: consider batching multiple properties into a single `POST /properties/batch` request (referenced in existing `TODO` comment in `CardWrapper.tsx`)

### 6.8 TD Fetch Already Cached
The details panel may have already fetched the TD (via react-query). We could read from react-query's cache to avoid a duplicate fetch. However, react-query's cache key is `['thing', urn]` and the cache may be stale. Decision: **fetch independently** — the hover card's fetch is lightweight and uses its own AbortController. Duplicate fetches are acceptable for now; a future optimization could check react-query's `queryClient.getQueryData(['thing', urn])` first.

### 6.9 Grace Period Timer Race
Scenario: user hovers marker A → card appears → user quickly moves to marker B.
- Mouse leaves marker A: 300ms dismiss timer starts for A
- Mouse enters marker B: new debounce timer starts
- If B's card appears before A's dismiss fires: two cards visible briefly — **bad**

Solution: entering a new marker immediately cancels the previous dismiss timer AND sets previous card to phase=`dismissing` with instant fade (no grace period). This is handled by the abort-all logic in §3.1.

---

## 7. Performance Considerations

### 7.1 DOM Impact
- One hover card rendered at a time (mutually exclusive)
- Portal mounts/unmounts the `HoverCard` component — no invisible DOM accumulation
- Max 3 polling `fetch` calls active at any time (one per HTTP property in the card)

### 7.2 Memory
- TD fetch results are NOT cached (fetch, use, discard on dismiss)
- Polling data is component-local state, garbage-collected on unmount
- `AbortController` instances are cleaned up on dismiss and on new hover

### 7.3 Rendering
- `HoverCard` uses CSS transforms for positioning (not top/left) to avoid layout thrashing
- Smart positioning calculation is a pure function — cheap (<1ms)
- Map drag/zoom events that update position are throttled via the existing 400ms debounce in `fetchAndRenderMarkers`

---

## 8. Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/features/map-view/types.ts` | **CREATE** | `HoverProperty`, `HoverState`, `HoverPhase` types |
| `frontend/src/features/map-view/useHttpPolling.ts` | **CREATE** | Lightweight 500ms HTTP polling hook with AbortController |
| `frontend/src/features/map-view/useHoverCard.ts` | **CREATE** | Hover state machine: debounce, fetch, dismiss, abort logic |
| `frontend/src/features/map-view/HoverCard.tsx` | **CREATE** | Standalone compact card UI with tooltip→card expand animation |
| `frontend/src/features/map-view/HoverCard.css` | **CREATE** | Expand/fade animations, layout, type badge styles |
| `frontend/src/features/map-view/MapView.tsx` | **MODIFY** | Add hover event bindings to markers; render HoverCard via portal; integrate `useHoverCard` hook |
| `docs/mapHoverCardPlan.md` | **CREATE** | This plan document |

No backend changes required. The existing `/api/v1/things/:urn` and property proxy endpoints suffice.

---

## 9. Open Questions & Future Work

1. **Property batch polling**: The existing `TODO` in `CardWrapper.tsx` mentions batching multiple observable properties into one `POST /properties/batch` request. The hover card could benefit from this — instead of 3 separate fetches every 500ms, a single batch request. This should be a follow-up task affecting both `CardWrapper` and `HoverCard`.

2. **WebSocket properties in hover card**: Currently, WS properties show only the type badge. In the future, the hover card could open a short-lived WS connection to show live WS values. This is complex (connection overhead, race conditions with dismiss) and deferred.

3. **Touch devices**: The hover card is mouse-only. On touch devices, a long-press could trigger it instead. Deferred.

4. **Marker cluster interaction**: The map has a `TODO` about `BMapLib.MarkerClusterer`. When clustering is implemented, hover behavior on clusters needs separate design.

5. **Accessibility**: The hover card should be keyboard-navigable (focus-visible on markers, Enter/Space to trigger the card). Deferred.

---

## 10. Implementation Order

| Step | Task | Estimated Complexity |
|------|------|---------------------|
| 1 | Create `types.ts` | Trivial |
| 2 | Create `useHttpPolling.ts` | Medium — must handle AbortController, error states, immediate-first-fetch |
| 3 | Create `useHoverCard.ts` | High — state machine with timers, abort logic, property selection, coordinate conversion |
| 4 | Create `HoverCard.tsx` + `HoverCard.css` | Medium — UI rendering, animations, smart positioning |
| 5 | Modify `MapView.tsx` | Medium — marker event binding, portal rendering, integration with existing refs |
| 6 | Manual testing | Varied — test with all 3 TD types (park, building-gate, parking-lot), rapid hover, map pan/zoom |
