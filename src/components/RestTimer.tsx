interface RestTimerProps {
  seconds: number        // countdown from this number
  nextSet: number
  totalSets: number
  onSkip: () => void
}

export function RestTimer({ seconds, nextSet, totalSets, onSkip }: RestTimerProps) {
  const circumference = 2 * Math.PI * 46  // r=46

  return (
    <div className="rt-container">
      <div className="rt-circle-wrap">
        <svg viewBox="0 0 144 144" className="rt-svg">
          <circle cx="72" cy="72" r="60" className="rt-circle-bg" />
          <circle cx="72" cy="72" r="60"
                  className="rt-circle-progress"
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={2 * Math.PI * 60 * (seconds / 120)}
          />
        </svg>
        <div className="rt-content">
          <p className="rt-lbl">Up Next</p>
          <p className="rt-val">{seconds}</p>
          <p className="rt-lbl">Get Ready</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="sl-label-main">
          SET {nextSet} OF {totalSets}
        </p>
        
        <button
          onClick={onSkip}
          className="sl-btn-secondary"
          style={{ padding: '12px 24px', fontSize: 12 }}
        >
          SKIP REST →
        </button>
      </div>
    </div>
  )
}
