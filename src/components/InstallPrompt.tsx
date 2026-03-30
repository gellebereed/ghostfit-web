'use client';
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [isReady, setIsReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true so we don't flash

  useEffect(() => {
    setIsReady(true);
    
    // Check if we are already installed/standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for Chrome/Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isReady || isStandalone) return null;

  // Render nothing if not iOS and no android install prompt is caught yet
  if (!isIOS && !deferredPrompt) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="install-banner">
      <div className="install-content">
        <div style={{ fontSize: 24 }}>👻</div>
        <div>
          <strong>Install GhostFit</strong>
          <p>Beat your past self from your home screen.</p>
          {isIOS && (
            <p className="ios-hint">Tap share <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" strokeWidth="2" style={{ display: 'inline', margin: '0 2px', verticalAlign: '-2px' }}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then <strong>Add to Home Screen</strong></p>
          )}
        </div>
      </div>
      {!isIOS && (
        <button onClick={handleInstallClick} className="install-btn">
          Install App
        </button>
      )}
    </div>
  );
}
