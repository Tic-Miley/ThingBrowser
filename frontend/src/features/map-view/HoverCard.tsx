// HoverCard — compact overlay for map marker hover preview.
// Renders via React portal into the map container, positioned
// with CSS transform for performant updates during map pan/zoom.

import { useHttpPolling } from "./useHttpPolling";
import type { HoverPhase, HoverProperty } from "./types";
import "./HoverCard.css";

// ==========================================
// Props
// ==========================================

interface HoverCardProps {
  phase: HoverPhase;
  markerTitle: string;
  address?: string;
  properties?: HoverProperty[];
  screenPosition: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// ==========================================
// Micro-component: live-polled property value
// ==========================================

function PolledValue({
  href,
  enabled,
}: {
  href: string;
  enabled: boolean;
}) {
  const { value, error, loading } = useHttpPolling({
    url: href,
    interval: 1000,
    enabled,
  });

  if (loading) {
    return <span className="hover-card-spinner" />;
  }

  if (error) {
    return <span className="hover-card-error">{error}</span>;
  }

  const displayValue =
    value === null || value === undefined
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  return (
    <span className="hover-card-property-value" title={displayValue}>
      {displayValue}
    </span>
  );
}

// ==========================================
// Micro-component: non-HTTP property type badge
// ==========================================

function TypeBadge({ dataType }: { dataType: string }) {
  return <span className="hover-card-type-badge">[{dataType}]</span>;
}

// ==========================================
// HoverCard main component
// ==========================================

export function HoverCard({
  phase,
  markerTitle,
  address,
  properties,
  screenPosition,
  onMouseEnter,
  onMouseLeave,
}: HoverCardProps) {
  // Map phase to CSS class
  const phaseClass =
    phase === "fetching"
      ? "hover-card-tooltip"
      : phase === "visible"
        ? "hover-card-expanded"
        : phase === "dismissing"
          ? "hover-card-dismissing"
          : "hover-card-tooltip"; // fallback

  const isVisible = phase === "visible";
  const shouldShowProperties = isVisible && properties !== undefined && properties.length > 0;
  const shouldShowError = isVisible && properties === undefined;
  const shouldPoll = isVisible; // only poll while fully visible

  return (
    <div
      className={`hover-card hover-card-animated ${phaseClass}`}
      style={{
        transform: `translate(${screenPosition.x}px, ${screenPosition.y}px)`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="hover-card-inner">
        {/* Title — always visible */}
        <div className="hover-card-title" title={markerTitle}>
          {markerTitle}
        </div>

        {/* Address — only when TD has loaded */}
        {address && (
          <div className="hover-card-address" title={address}>
            {address}
          </div>
        )}

        {/* Properties section */}
        {shouldShowProperties && (
          <>
            <div className="hover-card-divider" />
            {properties!.map((prop) => (
              <div key={prop.title} className="hover-card-property">
                <span
                  className="hover-card-property-label"
                  title={prop.title}
                >
                  {prop.title}
                </span>
                {prop.isHttp ? (
                  <PolledValue
                    href={prop.href}
                    enabled={shouldPoll}
                  />
                ) : (
                  <TypeBadge dataType={prop.dataType} />
                )}
              </div>
            ))}
          </>
        )}

        {/* TD fetch failed — show error banner */}
        {shouldShowError && (
          <>
            <div className="hover-card-divider" />
            <div className="hover-card-error-banner">加载失败</div>
          </>
        )}
      </div>
    </div>
  );
}
