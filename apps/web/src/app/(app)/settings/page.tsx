'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function SettingsPage() {
  const {
    items,
    stagedHighlights,
    syncRequests,
    error,
    uid,
    isAnonymous,
    signInWithGoogle,
    upgradeWithGoogle,
    signOut,
  } = useRecallData();
  const [authBusy, setAuthBusy] = useState(false);

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
          <p className="muted">Mode: {uid ? (isAnonymous ? 'Anonymous' : 'Google') : 'Connecting...'}</p>
          <p className="muted">User: {uid ?? 'Connecting...'}</p>
          <p className="muted">Latest request: {syncRequests[0]?.status ?? 'None'}</p>
          {error ? <p className="muted">{error}</p> : null}
          <div className="button-row">
            {isAnonymous ? (
              <Button
                variant="secondary"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  try {
                    await signInWithGoogle();
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                Sign In To Existing Google Account
              </Button>
            ) : null}
            <Button
              variant={isAnonymous ? 'ghost' : 'secondary'}
              disabled={authBusy}
              onClick={async () => {
                setAuthBusy(true);
                try {
                  if (isAnonymous) {
                    await upgradeWithGoogle();
                  } else {
                    await signInWithGoogle();
                  }
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              {isAnonymous ? 'Upgrade Trial To Google Account' : 'Re-auth With Google'}
            </Button>
            {!isAnonymous ? (
              <Button
                variant="ghost"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  try {
                    await signOut();
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                Sign Out
              </Button>
            ) : null}
          </div>
          <p className="muted">
            {isAnonymous
              ? 'Use Sign In if you already have a Google-backed Recall account. Use Upgrade if you want to keep this anonymous trial account and attach Google to it.'
              : 'Apple Books sync requests attach to this Firebase user ID. Use one stable signed-in account if you want the same library on production and future devices.'}
          </p>
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
