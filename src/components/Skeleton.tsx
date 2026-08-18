import type { CSSProperties } from 'react';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** A single shimmering placeholder block. */
export function Skeleton({ width, height, radius, className = '', style }: SkeletonProps) {
  return (
    <div
      className={`sk ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/**
 * The shared shape of every tab page: sticky header, a big title, then a stack
 * of cards. Pages differ in what fills those cards, not in the frame — so one
 * skeleton holds the frame steady for all of them and only the card count and
 * height need tuning per page.
 */
export function PageSkeleton({
  cards = 4,
  cardHeight = 104,
  hero,
  titleWidth = '52%',
}: {
  cards?: number;
  cardHeight?: number;
  /** Height of a lead block above the card stack (macro dash, stat row, etc). */
  hero?: number;
  titleWidth?: number | string;
}) {
  return (
    <div role="status" aria-label="Loading">
      <header className="hdr">
        <span className="hdr-logo">👻 GHOSTFIT</span>
        <Skeleton width={72} height={14} radius={7} />
      </header>

      <div style={{ padding: '22px 20px 0' }}>
        <Skeleton width={96} height={11} radius={5} />
        <Skeleton width={titleWidth} height={34} radius={10} style={{ marginTop: 12 }} />
      </div>

      {hero ? <div className="sk sk-card" style={{ margin: '18px 20px 0', height: hero }} /> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px 108px' }}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="sk sk-card" style={{ height: cardHeight }} />
        ))}
      </div>
    </div>
  );
}

/**
 * The home dashboard, drawn in grey.
 *
 * It mirrors the real layout box for box, so when data lands nothing moves —
 * the placeholders are simply replaced in place. That absence of reflow is
 * most of what makes an app feel fast; a centred spinner instead throws the
 * whole page away and rebuilds it, which reads as a wait.
 */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard">
      <header className="hdr">
        <span className="hdr-logo">👻 GHOSTFIT</span>
        <Skeleton width={86} height={14} radius={7} />
      </header>

      <div className="greeting">
        <Skeleton width="62%" height={24} radius={8} />
        <Skeleton width="44%" height={13} radius={6} style={{ marginTop: 8 }} />
      </div>

      {/* Battle card */}
      <div className="sk sk-card" style={{ margin: '16px 20px', height: 232 }} />

      {/* Today hero */}
      <div className="sk sk-card" style={{ margin: '0 20px', height: 316 }} />

      {/* Week panel: ring + day strip */}
      <div className="week-panel">
        <div className="week-panel-top">
          <Skeleton width={92} height={92} className="sk-circle" />
          <div className="week-panel-body">
            <Skeleton width={78} height={11} radius={5} />
            <Skeleton width="80%" height={12} radius={6} style={{ marginTop: 8 }} />
          </div>
        </div>
        <div className="week-row">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="day-chip" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <Skeleton width={30} height={30} className="sk-circle" />
              <Skeleton width={20} height={7} radius={4} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '8px 20px 0' }}>
        <Skeleton width={148} height={12} radius={6} />
      </div>

      {/* Dashboard tiles */}
      <div className="dash-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 116 }} />
        ))}
      </div>
    </div>
  );
}
