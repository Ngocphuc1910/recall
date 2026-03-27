'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren, type ReactNode } from 'react';

const nav = [
  { href: '/today', label: 'Today' },
  { href: '/library', label: 'Library' },
  { href: '/approval', label: 'Approval' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({
  title,
  subtitle,
  children,
  toolbar,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">R</div>
          <div>
            <p className="eyebrow">Recall</p>
            <h2>Premium workspace</h2>
          </div>
        </div>

        <nav className="app-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'nav-link active' : 'nav-link'}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        <header className="screen-header">
          <div>
            <p className="eyebrow">Recall</p>
            <h1>{title}</h1>
            {subtitle ? <p className="screen-subtitle">{subtitle}</p> : null}
          </div>
          {toolbar ? <div className="toolbar-row">{toolbar}</div> : null}
        </header>

        <section className="screen-content">{children}</section>
      </main>
    </div>
  );
}
