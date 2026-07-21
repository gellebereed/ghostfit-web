'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { applyAuraTheme, applyBaseTheme, getSavedTheme } from '@/lib/theme';

/** Applies the saved base theme + tints the app to the user's aura. Renders nothing. */
export default function AuraTheme() {
  const auraColor = useAppStore(s => s.profile?.auraColor);

  // Instant first paint from the cached profile, before Supabase loads
  useEffect(() => {
    applyBaseTheme(getSavedTheme());
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
