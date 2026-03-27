'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, Card, CategoryBadge, EmptyState, PriorityBadge } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { items, categories, deleteItem, markRecall } = useRecallData();
  const item = items.find((entry) => entry.id === params.id);
  const category = useMemo(
    () => categories.find((entry) => entry.id === item?.categoryId),
    [categories, item]
  );

  if (!item) {
    return (
      <AppShell title="Item Detail" subtitle="Detailed metadata and review history.">
        <EmptyState title="Item not found" subtitle="The selected recall item is missing." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Item Detail" subtitle="A cleaner editorial detail view for every stored memory.">
      <Card className="list-item">
        <div className="meta-row">
          <CategoryBadge category={category} />
          <PriorityBadge priorityCode={item.priorityCode} />
        </div>
        <h3>{item.content}</h3>
        {item.source ? <p>{item.source}</p> : null}
        {item.detail ? <p>{item.detail}</p> : null}
      </Card>

      <div className="detail-grid">
        <div className="stat">
          <span className="stat-label">Next Review</span>
          <span className="stat-value">{new Date(item.nextReviewDate).toLocaleDateString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Current Interval</span>
          <span className="stat-value">{item.currentInterval} days</span>
        </div>
        <div className="stat">
          <span className="stat-label">Times Reviewed</span>
          <span className="stat-value">{item.reviewCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Added</span>
          <span className="stat-value">{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="button-row">
        <Button variant="secondary" onClick={() => markRecall(item, false)}>
          Forgot
        </Button>
        <Button onClick={() => markRecall(item, true)}>I Recall</Button>
        <Button variant="destructive" onClick={() => deleteItem(item.id)}>
          Archive
        </Button>
      </div>
    </AppShell>
  );
}
