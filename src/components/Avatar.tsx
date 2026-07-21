import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { getCharEmoji } from '@/lib/avatar';
import { UserProfile } from '@/lib/types';

interface AvatarProps {
  type: 'user' | 'ghost';
  size?: number;
  tier?: number;
  animationState?: 'idle' | 'winning' | 'losing' | 'celebrating';
  profileOverride?: Partial<UserProfile>;
  className?: string;
}

/**
 * The Ghost — a real character, not an emoji in a box.
 * Expressions: idle (calm float) · celebrating (evil grin, cackle wobble)
 * · losing (KO'd — X eyes, fading out).
 */
function GhostSprite({ size, aura, state }: { size: number; aura: string; state: string }) {
  const losing = state === 'losing';
  const winning = state === 'celebrating' || state === 'winning';
  return (
    <div
      className={`ghost-sprite ${losing ? 'ghost-ko' : winning ? 'ghost-cackle' : 'ghost-float'}`}
      style={{ width: size, height: size, filter: `drop-shadow(0 0 ${size * 0.18}px ${aura}55)` }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {/* Body: dome + wavy hem */}
        <path
          d="M50 8
             C27 8 15 26 15 46
             L15 78
             Q19 72 24 78 Q29 84 34 78 Q39 72 44 78 Q50 84 56 78 Q61 72 66 78 Q71 84 76 78 Q81 72 85 78
             L85 46
             C85 26 73 8 50 8 Z"
          fill={losing ? '#2A2A35' : '#EDEDF4'}
          opacity={losing ? 0.75 : 0.95}
        />
        {/* Inner shade for depth */}
        <path
          d="M50 14 C31 14 21 29 21 46 L21 60 C30 55 70 55 79 60 L79 46 C79 29 69 14 50 14 Z"
          fill={losing ? '#1F1F28' : '#FFFFFF'}
          opacity="0.5"
        />
        {/* Aura blush cheeks */}
        {!losing && (
          <>
            <ellipse cx="30" cy="48" rx="6" ry="4" fill={aura} opacity="0.35" />
            <ellipse cx="70" cy="48" rx="6" ry="4" fill={aura} opacity="0.35" />
          </>
        )}
        {/* Eyes */}
        {losing ? (
          <g stroke="#EDEDF4" strokeWidth="4" strokeLinecap="round" opacity="0.9">
            <path d="M28 34 L40 44 M40 34 L28 44" />
            <path d="M60 34 L72 44 M72 34 L60 44" />
          </g>
        ) : winning ? (
          <g fill="#14141C">
            {/* Angry triumphant eyes with glowing pupils */}
            <path d="M26 34 L42 38 L42 46 Q34 48 26 42 Z" />
            <path d="M74 34 L58 38 L58 46 Q66 48 74 42 Z" />
            <circle cx="36" cy="42" r="2.6" fill={aura} />
            <circle cx="64" cy="42" r="2.6" fill={aura} />
          </g>
        ) : (
          <g fill="#14141C">
            <ellipse cx="34" cy="40" rx="6.5" ry="9" />
            <ellipse cx="66" cy="40" rx="6.5" ry="9" />
            <circle cx="36" cy="37" r="2.2" fill="#FFFFFF" opacity="0.9" />
            <circle cx="68" cy="37" r="2.2" fill="#FFFFFF" opacity="0.9" />
          </g>
        )}
        {/* Mouth */}
        {losing ? (
          <ellipse cx="50" cy="60" rx="6" ry="8" fill="#EDEDF4" opacity="0.7" />
        ) : winning ? (
          <path d="M32 56 Q50 74 68 56 Q60 68 50 68 Q40 68 32 56 Z" fill="#14141C" />
        ) : (
          <path d="M42 58 Q50 64 58 58" stroke="#14141C" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
        {/* Winning fangs */}
        {winning && (
          <g fill="#FFFFFF">
            <path d="M38 59 L42 66 L45 59 Z" />
            <path d="M55 59 L58 66 L62 59 Z" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function Avatar({
  type,
  size = 64,
  tier = 1,
  animationState = 'idle',
  profileOverride,
  className
}: AvatarProps) {
  const storeProfile = useAppStore(state => state.profile);
  const profile = profileOverride || storeProfile;

  const isUser = type === 'user';
  const photoUrl = isUser
    ? profile?.customAvatarDataUrl
    : profile?.customGhostDataUrl;
  const usesPhoto = isUser
    ? profile?.usesCustomAvatar
    : profile?.usesCustomGhost;
  const auraColor = isUser
    ? (profile?.auraColor ?? '#00FF87')
    : (profile?.ghostAuraColor ?? '#8B5CF6');
  const style = isUser
    ? (profile?.characterStyle ?? 'warrior')
    : (profile?.ghostStyle ?? 'warrior');
  const name = isUser
    ? (profile?.characterName ?? 'YOU')
    : (profile?.ghostName ?? 'GHOST');

  const [imgError, setImgError] = useState(false);

  // ── The Ghost: full character sprite, no frame ──
  if (!isUser && !(usesPhoto && photoUrl && !imgError)) {
    return (
      <div className={className} style={{ width: size, height: size, position: 'relative' }}>
        <GhostSprite size={size} aura={auraColor} state={animationState} />
      </div>
    );
  }

  // ── The Fighter (or photo avatars): aura-ring badge ──
  const celebrating = animationState === 'celebrating' || animationState === 'winning';
  const losing = animationState === 'losing';
  const ring = size * 0.06;

  return (
    <div
      className={`av-badge ${celebrating ? 'av-hype' : ''} ${losing ? 'av-down' : ''} ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        ['--av-aura' as string]: auraColor,
        ['--av-ring' as string]: `${Math.max(ring, 2.5)}px`,
      }}
    >
      <div className="av-ring" />
      <div className="av-core" style={{ background: `radial-gradient(circle at 35% 30%, ${auraColor}38, ${auraColor}0d 65%)` }}>
        {usesPhoto && photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', ...(isUser ? {} : { filter: 'grayscale(20%)' }) }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="av-emoji" style={{ fontSize: size * 0.52 }}>{getCharEmoji(style)}</span>
        )}
      </div>
      {isUser && tier >= 2 && (
        <div
          className="av-tier"
          style={{
            width: Math.max(size * 0.32, 16),
            height: Math.max(size * 0.32, 16),
            fontSize: Math.max(size * 0.15, 8),
            background: tier >= 4 ? 'linear-gradient(135deg,#FFD700,#b8860b)' : `linear-gradient(135deg, ${auraColor}, ${auraColor}99)`,
          }}
        >
          {tier}
        </div>
      )}
    </div>
  );
}
