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
    : (profile?.ghostAuraColor ?? '#FFFFFF');
  const style = isUser
    ? (profile?.characterStyle ?? 'warrior')
    : (profile?.ghostStyle ?? 'warrior');
  const name = isUser
    ? (profile?.characterName ?? 'YOU')
    : (profile?.ghostName ?? 'GHOST');

  const borderColor = isUser ? auraColor : `${auraColor}66`;
  const opacity = isUser ? 1 : 0.65;
  const glowStyle = (animationState === 'winning' || animationState === 'celebrating')
    ? { boxShadow: `0 0 20px ${auraColor}60` }
    : {};

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        border: `2px solid ${borderColor}`,
        background: isUser ? `${auraColor}15` : '#131313',
        opacity,
        ...glowStyle
      }}
    >
      {usesPhoto && photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          style={!isUser ? { filter: 'grayscale(20%) blur(0.3px)' } : {}}
        />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ fontSize: size * 0.45 }}
        >
          {getCharEmoji(style)}
        </div>
      )}
      
      {/* State overlays */}
      {animationState === 'celebrating' && (
        <div className="absolute inset-0 bg-[#00FF87]/15 animate-pulse" />
      )}
      {animationState === 'losing' && (
        <div className="absolute inset-0 bg-red-500/20" />
      )}
      
      {/* Tier badge — only for user */}
      {isUser && tier >= 2 && (
        <div
          className="absolute bottom-0 right-0 rounded-full
                     flex items-center justify-center font-black
                     border border-[#0A0A0A]"
          style={{
            width: size * 0.3,
            height: size * 0.3,
            fontSize: size * 0.14,
            background: tier >= 4 ? '#FFD700' : '#00FF87',
            color: '#0A0A0A',
            zIndex: 2
          }}
        >
          {tier}
        </div>
      )}
    </div>
  );
}
