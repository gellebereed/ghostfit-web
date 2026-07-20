'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { applyAuraTheme } from '@/lib/theme';

/** Tints the app to the user's aura color. Renders nothing. */
export default function AuraTheme() {
  const auraColor = useAppStore(s => s.profile?.auraColor);

  // Instant first paint from the cached profile, before Supabase loads
  useEffect(() => {
    try {
      const cached = localStorage.getItem('ghostfit_profile');
      if (cached) applyAuraTheme(JSON.parse(cached).auraColor);
    } catch { /* default theme stays */ }
  }, []);

  useEffect(() => {
    if (auraColor) applyAuraTheme(auraColor);
  }, [auraColor]);

  return null;
}
