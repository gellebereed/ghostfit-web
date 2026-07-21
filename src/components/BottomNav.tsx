import Link from 'next/link';

export type NavTab = 'home' | 'arena' | 'fuel' | 'quests' | 'history' | 'profile';

const TABS: Array<{ id: NavTab; href: string; label: string; icon: React.ReactNode }> = [
  {
    id: 'home', href: '/', label: 'Home',
    icon: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  },
  {
    id: 'arena', href: '/arena', label: 'Arena',
    icon: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
  },
  {
    id: 'fuel', href: '/nutrition', label: 'Fuel',
    icon: <><path d="M12 20c4.4 0 8-3.6 8-8 0-2.8-1.4-5.2-3.6-6.6C15 4.4 13.6 4 12 4s-3 .4-4.4 1.4C5.4 6.8 4 9.2 4 12c0 4.4 3.6 8 8 8Z"/><path d="M12 4c0-1.1.9-2 2-2"/><path d="M9.5 11.5c.8-.8 2.2-.8 3 0"/></>,
  },
  {
    id: 'quests', href: '/quests', label: 'Quests',
    icon: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  },
  {
    id: 'history', href: '/history', label: 'History',
    icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  },
  {
    id: 'profile', href: '/profile', label: 'You',
    icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  },
];

export default function BottomNav({ active }: { active: NavTab }) {
  return (
    <nav className="nav nav-v2">
      <div className="nav-brand">👻 <span>GHOSTFIT</span></div>
      {TABS.map(tab => (
        <Link key={tab.id} href={tab.href} className={`nav-item ${active === tab.id ? 'active' : ''}`}>
          <span className="nav-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.icon}</svg>
          </span>
          <span className="nav-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
