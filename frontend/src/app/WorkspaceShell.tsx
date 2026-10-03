'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './WorkspaceShell.module.css';

const SECTIONS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/bids', label: 'Bids' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/ai-analysis', label: 'AI Analysis' },
];

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { setAuthenticated(Boolean(localStorage.getItem('token'))); }, [pathname]);
  const show = authenticated && !['/', '/login', '/register'].includes(pathname);
  if (!show) return <>{children}</>;
  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Application navigation">
      <div className={styles.brand}><strong>AI Procurement</strong><span>Workspace</span></div>
      <label htmlFor="procurement-nav-search">Find a section</label>
      <input id="procurement-nav-search" type="search" placeholder="Search navigation" value={query} onChange={event => setQuery(event.target.value)} />
      <nav aria-label="Sections">
        {SECTIONS.filter(item => item.label.toLowerCase().includes(query.toLowerCase().trim())).map(item =>
          <Link key={item.href} href={item.href} className={pathname === item.href ? styles.active : undefined}>{item.label}</Link>
        )}
      </nav>
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
