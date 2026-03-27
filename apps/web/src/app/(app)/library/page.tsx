'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CategoryBadge, EmptyState, PriorityBadge } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function LibraryPage() {
  const { items, categories } = useRecallData();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let next = items.filter((item) => item.status === 'active');
    if (selectedCategory) {
      next = next.filter((item) => item.categoryId === selectedCategory);
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      next = next.filter(
        (item) =>
          item.content.toLowerCase().includes(query) ||
          item.source.toLowerCase().includes(query) ||
          item.detail.toLowerCase().includes(query)
      );
    }
    return next;
  }, [items, search, selectedCategory]);

  return (
    <AppShell
      title="Library"
      subtitle="Everything worth remembering, searchable and sorted for actual daily use."
    >
      <Card>
        <div className="screen-content">
          <input
            className="search-input"
            placeholder="Search content, source, or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="chip-grid">
            <button
              className={selectedCategory === null ? 'chip active' : 'chip'}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.id ? 'chip active' : 'chip'}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          subtitle="Start reviewing or import highlights to build your library."
        />
      ) : (
        <div className="list-stack">
          {filtered.map((item) => {
            const category = categories.find((entry) => entry.id === item.categoryId);
            return (
              <Card key={item.id} className="list-item">
                <div className="meta-row">
                  <CategoryBadge category={category} />
                  <PriorityBadge priorityCode={item.priorityCode} />
                </div>
                <Link href={`/item/${item.id}`}>
                  <h3>{item.content}</h3>
                </Link>
                <p>{item.source || 'Manual item'}</p>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
