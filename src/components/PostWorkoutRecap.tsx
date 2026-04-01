'use client';
import { useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { Avatar } from './Avatar';
import { calculateCaloriesBurned, getDisplayCalories } from '@/utils/calorieCalculator';

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
  onContinue
}: PostWorkoutRecapProps) {
  const profile = useAppStore(state => state.profile);
  const calories = calculateCaloriesBurned(
    exerciseSessions,
    profile?.weight_kg ?? 75
  );
  const hasExactWeight = !!profile?.weight_kg;
  const isWin = workoutResult === 'win';
  
  // Shareable card ref
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleShare() {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0A0A0A',
        scale: 2,  // Retina quality
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
          // Fallback — download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ghostfit-battle.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png', 0.95);
    } catch (e) {
      console.error('Share failed:', e);
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col 
                    items-center justify-center p-4 overflow-y-auto">
      
      {/* THE SHAREABLE CARD */}
      <div
        ref={cardRef}
        className="w-full max-w-[380px] rounded-3xl overflow-hidden
                   border border-white/10"
        style={{
          background: isWin 
            ? 'linear-gradient(160deg, #0D2010 0%, #0A0A0A 50%, #0D2010 100%)'
            : 'linear-gradient(160deg, #1A0808 0%, #0A0A0A 50%, #1A0808 100%)'
        }}
      >
        {/* TOP — App branding */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">👻</span>
            <span className="text-white font-black text-sm tracking-widest uppercase">
              GhostFit
            </span>
          </div>
          <span className="text-gray-600 text-xs">ghostfit.app</span>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-white/5 mx-5" />

        {/* FIGHTERS */}
        <div className="flex items-center justify-between px-8 py-6">
          {/* YOU */}
          <div className="flex flex-col items-center gap-2">
            <Avatar
              type="user"
              size={72}
              animationState={isWin ? 'celebrating' : 'losing'}
              tier={profile?.equippedCosmetics?.tier ? parseInt(profile.equippedCosmetics.tier) : 1}
            />
            <span className="text-white text-xs font-black tracking-widest">
              {profile?.characterName ?? 'YOU'}
            </span>
          </div>

          {/* CENTER RESULT */}
          <div className="flex flex-col items-center gap-1">
            <span className={`text-3xl font-black tracking-tight leading-none
              ${isWin ? 'text-[#00FF87]' : 'text-red-400'}`}>
              {isWin ? 'WIN' : 'LOSS'}
            </span>
            <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">
              {exercisesWon}/{totalExercises} exercises
            </span>
          </div>

          {/* GHOST */}
          <div className="flex flex-col items-center gap-2">
            <Avatar
              type="ghost"
              size={72}
              animationState={isWin ? 'losing' : 'celebrating'}
            />
            <span className="text-gray-500 text-xs font-black tracking-widest">
              {profile?.ghostName ?? 'GHOST'}
            </span>
          </div>
        </div>

        {/* RESULT BANNER */}
        <div className={`mx-5 py-3 rounded-2xl text-center mb-5
          ${isWin 
            ? 'bg-[#00FF87]/10 border border-[#00FF87]/30' 
            : 'bg-red-500/10 border border-red-500/20'}`}>
          <p className={`text-lg font-black tracking-wide
            ${isWin ? 'text-[#00FF87]' : 'text-red-400'}`}>
            {isWin ? '🔥 YOU WIN' : '💀 GHOST WINS'}
          </p>
          {isWin && newStreak >= 2 && (
            <p className="text-[#00FF87]/70 text-xs font-bold mt-0.5">
              {newStreak} day win streak 🔥
            </p>
          )}
          {!isWin && (
            <p className="text-red-400/60 text-xs mt-0.5">
              Rematch tomorrow — it's waiting 👻
            </p>
          )}
        </div>

        {/* STATS GRID — 2×3 */}
        <div className="grid grid-cols-3 gap-2 px-5 pb-5">
          {[
            {
              value: totalReps,
              label: 'Total Reps',
              icon: '💪'
            },
            {
              value: setsCompleted,
              label: 'Sets Done',
              icon: '⚡'
            },
            {
              value: `${getDisplayCalories(calories, hasExactWeight)} kcal`,
              label: 'Calories',
              icon: '🔥'
            },
            {
              value: formatDuration(durationSeconds),
              label: 'Duration',
              icon: '⏱'
            },
            {
              value: exercisesWon,
              label: 'Won',
              icon: '🏆'
            },
            {
              // Only show streak on wins, show "—" on loss
              value: isWin && newStreak > 0 ? `${newStreak} 🔥` : '—',
              label: 'Streak',
              icon: isWin ? '🔥' : '💀'
            },
          ].map((stat, i) => (
            <div key={i}
                 className="bg-[#141414] rounded-xl py-3 px-2 text-center
                            border border-white/5">
              <p className={`text-base font-black leading-none
                ${isWin ? 'text-white' : i === 5 ? 'text-gray-600' : 'text-white'}`}>
                {stat.value}
              </p>
              <p className="text-gray-600 text-[10px] uppercase tracking-wide
                            font-bold mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Calorie disclaimer if estimated */}
        {!hasExactWeight && (
          <p className="text-center text-gray-700 text-[9px] pb-3 -mt-2">
            ~ estimated · add weight in Profile for accuracy
          </p>
        )}
      </div>

      {/* ACTION BUTTONS — outside shareable card */}
      <div className="w-full max-w-[380px] mt-4 space-y-3">
        <button
          onPointerDown={handleShare}
          style={{ touchAction: 'manipulation' }}
          className="w-full py-4 rounded-2xl font-extrabold text-sm uppercase
                     tracking-widest border border-[#00FF87]/40 text-[#00FF87]
                     active:scale-[0.98] transition-transform
                     flex items-center justify-center gap-2"
        >
          <span>📤</span>
          Share Result
        </button>
        
        <button
          onPointerDown={onContinue}
          style={{ touchAction: 'manipulation' }}
          className="w-full py-4 rounded-2xl font-extrabold text-sm uppercase
                     tracking-widest bg-[#141414] text-white
                     active:scale-[0.98] transition-transform"
        >
          Back to Home →
        </button>
      </div>
    </div>
  );
}
