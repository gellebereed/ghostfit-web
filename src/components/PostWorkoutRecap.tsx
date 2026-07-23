'use client';
import { useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { Avatar } from './Avatar';
import { calculateCaloriesBurned, getDisplayCalories } from '@/utils/calorieCalculator';
import { ChestDrop, chestMeta } from '@/lib/chest';
import { arcadeSounds } from '@/utils/arcadeSounds';
import Celebration from './Celebration';

interface PostWorkoutRecapProps {
  workoutResult: 'win' | 'loss';
  exerciseSessions: Array<{
    exerciseName: string;
    metricType: string;
    totalReps: number;
    avgWeight: number;
    setsCompleted: number;
    totalDuration: number;
  }>;
  newStreak: number;
  totalReps: number;
  setsCompleted: number;
  exercisesWon: number;
  totalExercises: number;
  durationSeconds: number;
  chest?: ChestDrop;
  tierLabel?: string;
  shieldUsed?: boolean;
  onContinue: () => void;
}

export default function PostWorkoutRecap({
  workoutResult,
  exerciseSessions,
  newStreak,
  totalReps,
  setsCompleted,
  exercisesWon,
  totalExercises,
  durationSeconds,
  chest,
  tierLabel,
  shieldUsed,
  onContinue
}: PostWorkoutRecapProps) {
  const profile = useAppStore(state => state.profile);
  const [chestOpened, setChestOpened] = useState(false);
  const [sharing, setSharing] = useState(false);

  function openChest() {
    if (chestOpened) return;
    setChestOpened(true);
    if (localStorage.getItem('ghostfit_sound_enabled') !== 'false') {
      try { arcadeSounds.coinEarned(); } catch { /* sound is optional */ }
    }
  }

  const calories = calculateCaloriesBurned(
    exerciseSessions,
    profile?.weight_kg ?? 75
  );
  const hasExactWeight = !!profile?.weight_kg;
  const isWin = workoutResult === 'win';
  
  // Shareable card ref
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleShare() {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0A0A0A',
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'ghostfit-battle.png', { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: isWin ? 'I just beat my ghost on GhostFit! 👻🔥' : 'Ghost got me today. Rematch tomorrow 👻',
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ghostfit-battle.png';
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, 'image/png', 0.95);
    } catch (e) {
      console.error('Share failed:', e);
      setSharing(false);
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  return (
    <div className="recap-modal-overlay">
      {isWin && <Celebration />}

      <div className="recap-modal-container">
        {/* THE SHAREABLE CARD */}
        <div
          ref={cardRef}
          className={`recap-card-shell ${isWin ? 'win-theme' : 'loss-theme'}`}
        >
          {/* TOP — App branding */}
          <div className="recap-header">
            <div className="recap-brand">
              <span className="recap-brand-icon">👻</span>
              <span className="recap-brand-name">GHOSTFIT</span>
            </div>
            <span className="recap-brand-domain">ghostfit.app</span>
          </div>

          <div className="recap-divider" />

          {/* FIGHTERS MATCHUP */}
          <div className="recap-fighters-row">
            {/* YOU */}
            <div className="recap-fighter">
              <Avatar
                type="user"
                size={68}
                animationState={isWin ? 'celebrating' : 'losing'}
                tier={profile?.equippedCosmetics?.tier ? parseInt(profile.equippedCosmetics.tier) : 1}
              />
              <span className="recap-fighter-name">
                {profile?.characterName ?? 'YOU'}
              </span>
            </div>

            {/* CENTER RESULT */}
            <div className="recap-center-badge">
              <span className={`recap-outcome ${isWin ? 'win' : 'loss'}`}>
                {isWin ? 'WIN' : 'LOSS'}
              </span>
              <span className="recap-score">
                {exercisesWon}/{totalExercises} EXERCISES
              </span>
            </div>

            {/* GHOST */}
            <div className="recap-fighter">
              <Avatar
                type="ghost"
                size={68}
                animationState={isWin ? 'losing' : 'celebrating'}
              />
              <span className="recap-fighter-name ghost">
                {profile?.ghostName ?? 'GHOST'}
              </span>
            </div>
          </div>

          {/* RESULT BANNER */}
          <div className={`recap-banner-box ${isWin ? 'win' : 'loss'}`}>
            <p className={`recap-banner-title ${isWin ? 'win' : 'loss'}`}>
              {isWin ? '🔥 YOU WIN' : '💀 GHOST WINS'}
            </p>
            {isWin && newStreak >= 2 && (
              <p className="recap-banner-sub win">
                {newStreak} day win streak 🔥
              </p>
            )}
            {isWin && tierLabel && (
              <p className="recap-banner-sub dim">
                Showing up like this is what a {tierLabel} does.
              </p>
            )}
            {!isWin && shieldUsed && (
              <p className="recap-banner-sub win">
                🛡️ Streak Shield absorbed the loss — streak survives
              </p>
            )}
            {!isWin && !shieldUsed && (
              <p className="recap-banner-sub loss">
                Rematch tomorrow — it&apos;s waiting 👻
              </p>
            )}
          </div>

          {/* STATS GRID — 3x2 */}
          <div className="recap-stats-grid">
            {[
              { value: totalReps, label: 'Total Reps', icon: '💪' },
              { value: setsCompleted, label: 'Sets Done', icon: '⚡' },
              { value: `${getDisplayCalories(calories, hasExactWeight)} kcal`, label: 'Calories', icon: '🔥' },
              { value: formatDuration(durationSeconds), label: 'Duration', icon: '⏱' },
              { value: exercisesWon, label: 'Won', icon: '🏆' },
              { value: isWin && newStreak > 0 ? `${newStreak} 🔥` : '—', label: 'Streak', icon: isWin ? '🔥' : '💀' },
            ].map((stat, i) => (
              <div key={i} className="recap-stat-card">
                <span className="recap-stat-value">{stat.value}</span>
                <span className="recap-stat-label">
                  <span className="stat-icon">{stat.icon}</span> {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Calorie disclaimer if estimated */}
          {!hasExactWeight && (
            <p className="recap-disclaimer">
              ~ estimated · add weight in Profile for accuracy
            </p>
          )}
        </div>

        {/* MYSTERY CHEST */}
        {chest && (
          <div className="recap-chest-wrapper">
            {!chestOpened ? (
              <button onClick={openChest} className="recap-chest-sealed">
                <span className="chest-emoji">🎁</span>
                <span className="chest-text">MYSTERY CHEST — TAP TO OPEN</span>
              </button>
            ) : (
              <div className="recap-chest-open" style={{ borderColor: chestMeta(chest.rarity).color }}>
                <span className="chest-emoji">{chestMeta(chest.rarity).emoji}</span>
                <div className="chest-info">
                  <span className="chest-rarity" style={{ color: chestMeta(chest.rarity).color }}>
                    {chestMeta(chest.rarity).label.toUpperCase()} DROP
                  </span>
                  <span className="chest-coins">+{chest.coins} Soul Coins</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="recap-actions-group">
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="recap-btn-share"
          >
            <span>📤</span>
            <span>{sharing ? 'Generating Image...' : 'Share Result'}</span>
          </button>
          
          <button
            type="button"
            onClick={onContinue}
            className="recap-btn-continue"
          >
            <span>Back to Home →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
