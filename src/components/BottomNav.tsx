import Link from 'next/link';

export type NavTab = 'home' | 'arena' | 'fuel' | 'quests' | 'history' | 'profile';

const TABS: Array<{ id: NavTab; href: string; label: string; icon: React.ReactNode }> = [
  {
    id: 'home', href: '/', label: 'HOME',
    icon: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  },
  {
    id: 'arena', href: '/arena', label: 'ARENA',
    icon: <><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m5 13-2 2 4 4 2-2"/></>,
  },
  {
    id: 'fuel', href: '/nutrition', label: 'FUEL',
    icon: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></>,
  },
  {
    id: 'quests', href: '/quests', label: 'QUESTS',
    icon: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  },
  {
    id: 'history', href: '/history', label: 'HISTORY',
    icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  },
  {
    id: 'profile', href: '/profile', label: 'PROFILE',
    icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  },
];

export default function BottomNav({ active }: { active: NavTab }) {
  return (
    <nav className="nav">
      {TABS.map(tab => (
        <Link key={tab.id} href={tab.href} className={`nav-item ${active === tab.id ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{tab.icon}</svg>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
