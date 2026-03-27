'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function SettingsPage() {
  const { items, stagedHighlights, syncRequests, error, uid } = useRecallData();

  return (
    <AppShell
      title="Settings"
      subtitle="Sync state, defaults, operational controls, and advanced tools."
      toolbar={<Link className="button secondary" href="/import">Open Import Utility</Link>}
    >
      <div className="detail-grid">
        <Card>
          <p className="eyebrow">Cloud Sync</p>
          <h3>Firebase status</h3>
          <p className="muted">User: {uid ?? 'Connecting...'}</p>
          <p className="muted">Latest request: {syncRequests[0]?.status ?? 'None'}</p>
          {error ? <p className="muted">{error}</p> : null}
        </Card>
        <Card>
          <p className="eyebrow">Statistics</p>
          <h3>Current totals</h3>
          <div className="detail-grid">
            <div className="stat">
              <span className="stat-label">Active Items</span>
              <span className="stat-value">
                {items.filter((item) => item.status === 'active').length}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Staged Highlights</span>
              <span className="stat-value">{stagedHighlights.length}</span>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
