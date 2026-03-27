'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { PRIORITY_DEFINITIONS, type Category, type PriorityCode } from '@recall/contracts';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
}) {
  return (
    <button {...props} className={`button ${variant} ${props.className ?? ''}`.trim()}>
      {children}
    </button>
  );
}

export function CategoryBadge({ category }: { category?: Category }) {
  return (
    <span
      className="badge badge-category"
      style={{
        color: category?.color ?? 'var(--recall-color-accent)',
        backgroundColor: `${category?.color ?? '#0F6FFF'}1a`,
      }}
    >
      {category?.name ?? 'Other'}
    </span>
  );
}

export function PriorityBadge({
  priorityCode,
}: {
  priorityCode: PriorityCode;
}) {
  const priority =
    PRIORITY_DEFINITIONS.find((entry) => entry.code === priorityCode) ??
    PRIORITY_DEFINITIONS[1];
  return (
    <span
      className="badge badge-priority"
      style={{
        color: priority.color,
        backgroundColor: `${priority.color}1a`,
      }}
    >
      <span className="dot" style={{ backgroundColor: priority.color }} />
      {priority.label}
    </span>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="empty-state">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </Card>
  );
}
