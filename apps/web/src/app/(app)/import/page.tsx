'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/recall-ui';
import { useRecallData } from '@/lib/use-recall-data';

export default function ImportPage() {
  const { importFromJson } = useRecallData();
  const [json, setJson] = useState('');
  const [summary, setSummary] = useState<string>('');

  return (
    <AppShell
      title="Import"
      subtitle="Fallback utility for bulk Apple Books JSON imports."
    >
      <Card>
        <div className="screen-content">
          <div>
            <label className="field-label">JSON payload</label>
            <textarea
              className="textarea"
              value={json}
              onChange={(event) => setJson(event.target.value)}
              placeholder="Paste Apple Books export JSON"
            />
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() => {
                const result = importFromJson(json);
                setSummary(JSON.stringify(result.summary, null, 2));
              }}
            >
              Validate
            </Button>
          </div>
          {summary ? <pre className="card">{summary}</pre> : null}
        </div>
      </Card>
    </AppShell>
  );
}
