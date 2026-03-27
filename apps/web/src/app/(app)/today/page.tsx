'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card, CategoryBadge, EmptyState, PriorityBadge } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function TodayPage() {
  const { todayItems, categories, markRecall, addItem, loading, error } = useRecallData();
  const [content, setContent] = useState('');
  const [detail, setDetail] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'other');
  const [priorityCode, setPriorityCode] = useState<number>(2);

  const currentItem = todayItems[0];
  const category = useMemo(
    () => categories.find((entry) => entry.id === currentItem?.categoryId),
    [categories, currentItem]
  );

  return (
    <AppShell
      title="Today"
      subtitle="A focused daily review flow for the ideas you actually want to retain."
      toolbar={
        <Link className="button primary" href="/approval">
          Open Approval Inbox
        </Link>
      }
    >
      {error ? <Card>{error}</Card> : null}
      <div className="two-column">
        <div>
          {loading ? (
            <Card>Loading today&apos;s review queue...</Card>
          ) : currentItem ? (
            <Card className="hero-card">
              <div className="pill-row">
                <CategoryBadge category={category} />
                <PriorityBadge priorityCode={currentItem.priorityCode} />
              </div>
              <div className="hero-quote">{currentItem.content}</div>
              {currentItem.detail ? <p className="hero-detail">{currentItem.detail}</p> : null}
              {currentItem.source ? <p className="muted">{currentItem.source}</p> : null}
              <div className="button-row">
                <Button variant="secondary" onClick={() => markRecall(currentItem, false)}>
                  Forgot
                </Button>
                <Button onClick={() => markRecall(currentItem, true)}>I Recall</Button>
                <Link className="button ghost" href={`/item/${currentItem.id}`}>
                  Open Detail
                </Link>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="All caught up"
              subtitle="No items are due right now. Add something worth remembering or wait for the next review."
            />
          )}
        </div>

        <Card>
          <div className="button-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <p className="eyebrow">Quick Add</p>
              <h3>Add a new recall item</h3>
            </div>
          </div>

          <div className="screen-content">
            <div>
              <label className="field-label">Content</label>
              <textarea
                className="textarea"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What do you want to remember?"
              />
            </div>

            <div>
              <label className="field-label">Notes</label>
              <textarea
                className="textarea"
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Context or explanation"
              />
            </div>

            <div>
              <label className="field-label">Source</label>
              <input
                className="text-input"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Book, article, course..."
              />
            </div>

            <div>
              <label className="field-label">Category</label>
              <div className="chip-grid">
                {categories.map((entry) => (
                  <button
                    key={entry.id}
                    className={entry.id === categoryId ? 'chip active' : 'chip'}
                    onClick={() => setCategoryId(entry.id)}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">Priority</label>
              <div className="priority-grid">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={value === priorityCode ? 'priority-card active' : 'priority-card'}
                    onClick={() => setPriorityCode(value)}
                  >
                    <PriorityBadge priorityCode={value as 1 | 2 | 3 | 4 | 5} />
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={async () => {
                if (!content.trim()) return;
                await addItem({
                  content,
                  detail,
                  source,
                  categoryId,
                  priorityCode: priorityCode as 1 | 2 | 3 | 4 | 5,
                });
                setContent('');
                setDetail('');
                setSource('');
                setPriorityCode(2);
              }}
            >
              Add Item
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
