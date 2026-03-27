'use client';

import { useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card, EmptyState, PriorityBadge } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function ApprovalPage() {
  const {
    categories,
    pendingHighlights,
    stagedHighlights,
    syncRequests,
    approveHighlights,
    rejectHighlights,
    requestAppleBooksSync,
    updateStagedHighlightCategory,
    updateStagedHighlightPriority,
  } = useRecallData();

  const approved = useMemo(
    () => stagedHighlights.filter((highlight) => highlight.approvalStatus === 'approved'),
    [stagedHighlights]
  );
  const rejected = useMemo(
    () => stagedHighlights.filter((highlight) => highlight.approvalStatus === 'rejected'),
    [stagedHighlights]
  );
  const readyToApprove = pendingHighlights.filter(
    (highlight) => highlight.categoryStatus === 'chosen' && !!highlight.categoryId
  );

  return (
    <AppShell
      title="Approval"
      subtitle="Apple Books highlights land here first so you can classify them before they enter the recall cycle."
      toolbar={
        <Button onClick={() => requestAppleBooksSync()}>Sync Apple Books</Button>
      }
    >
      {syncRequests[0]?.resultSummary ? <Card>{syncRequests[0].resultSummary}</Card> : null}

      <div className="button-row">
        <Button variant="secondary" onClick={() => approveHighlights(readyToApprove)}>
          Approve All Ready ({readyToApprove.length})
        </Button>
        <Button
          variant="destructive"
          onClick={() => rejectHighlights(pendingHighlights.map((highlight) => highlight.id))}
        >
          Reject All
        </Button>
      </div>

      {pendingHighlights.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          subtitle="Request an Apple Books sync, then approve the incoming highlights here."
        />
      ) : (
        <div className="list-stack">
          {pendingHighlights.map((highlight) => (
            <Card key={highlight.id} className="list-item">
              <div className="meta-row">
                <PriorityBadge priorityCode={highlight.priorityCode} />
                <span className="badge">{formatDate(highlight.highlightedAt)}</span>
              </div>
              <h3>{highlight.content}</h3>
              {highlight.detail ? <p>{highlight.detail}</p> : null}
              <div className="chip-grid">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={highlight.categoryId === category.id ? 'chip active' : 'chip'}
                    onClick={() =>
                      updateStagedHighlightCategory(highlight.id, category.id)
                    }
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              <div className="priority-grid">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={value === highlight.priorityCode ? 'priority-card active' : 'priority-card'}
                    onClick={() => updateStagedHighlightPriority(highlight.id, value)}
                  >
                    <PriorityBadge priorityCode={value as 1 | 2 | 3 | 4 | 5} />
                  </button>
                ))}
              </div>
              <div className="button-row">
                <Button variant="destructive" onClick={() => rejectHighlights([highlight.id])}>
                  Reject
                </Button>
                <Button
                  onClick={() => approveHighlights([highlight])}
                  disabled={!highlight.categoryId || highlight.categoryStatus !== 'chosen'}
                >
                  Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid-split">
        <Card>
          <p className="eyebrow">Approved</p>
          <h3>Imported into Recall</h3>
          <div className="list-stack">
            {approved.slice(0, 5).map((highlight) => (
              <div key={highlight.id}>
                <strong>{highlight.source}</strong>
                <p className="muted">{highlight.content}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="eyebrow">Rejected</p>
          <h3>Stored for dedupe</h3>
          <div className="list-stack">
            {rejected.slice(0, 5).map((highlight) => (
              <div key={highlight.id}>
                <strong>{highlight.source}</strong>
                <p className="muted">{highlight.content}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString();
}
