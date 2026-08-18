'use client';
import { useState } from 'react';
import { applyComebackChoice, type ComebackChoice, type LayoffAssessment } from '@/lib/adherence';

/**
 * The conversation the app should have after a gap: name the gap, say plainly
 * what has and has not changed physically, recommend one option, and let the
 * user overrule it. No guilt — guilt is why people do not come back.
 */
export default function ComebackModal({
  assessment,
  onResolved,
  onDismiss,
}: {
  assessment: LayoffAssessment;
  onResolved: (choice: ComebackChoice) => void;
  onDismiss: () => void;
}) {
  const [choice, setChoice] = useState<ComebackChoice>(assessment.recommended);
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await applyComebackChoice(choice, assessment);
      onResolved(choice);
    } catch (err) {
      console.error('Comeback apply failed:', err);
      setWorking(false);
    }
  }

  return (
    <div className="dialog-overlay comeback-overlay">
      <div className="dialog comeback">
        <span className="comeback-kicker">WELCOME BACK</span>
        <h3>{assessment.headline}</h3>
        <p className="comeback-lead">{assessment.explanation}</p>

        <div className="comeback-science">
          <span className="comeback-science-tag">What actually changed</span>
          <p>{assessment.physiology}</p>
        </div>

        <div className="comeback-options">
          {assessment.options.map(option => (
            <button
              key={option.id}
              className={`comeback-option ${choice === option.id ? 'on' : ''}`}
              onClick={() => setChoice(option.id)}
              disabled={working}
            >
              <span className="comeback-option-head">
                <span className="comeback-radio">{choice === option.id ? '●' : '○'}</span>
                {option.label}
                {option.recommended && <span className="comeback-rec">Recommended</span>}
              </span>
              <span className="comeback-option-detail">{option.detail}</span>
            </button>
          ))}
        </div>

        <div className="dialog-btns">
          <button className="give-up" onClick={onDismiss} disabled={working}>Ask me later</button>
          <button className="keep" onClick={confirm} disabled={working}>
            {working ? 'Rebuilding…' : 'Apply →'}
          </button>
        </div>
      </div>
    </div>
  );
}
