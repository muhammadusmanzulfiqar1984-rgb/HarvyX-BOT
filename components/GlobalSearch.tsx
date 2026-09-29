'use client';

import { parseJson } from '@/lib/client-api';
import { useEffect, useState } from 'react';

export type SearchHit = {
  type: string;
  id: string;
  title: string;
  href?: string;
};

export function GlobalSearch({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (hit: SearchHit) => void;
}) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(async (res) => {
          const data = await parseJson(res);
          if (!res.ok) throw new Error(data?.error || 'Search failed.');
          if (!cancelled) setResults(Array.isArray(data.results) ? data.results : []);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Search failed.');
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  if (!query.trim()) {
    return <p className="shell-muted" style={{ padding: 12 }}>Type to search…</p>;
  }

  return (
    <div className="global-search">
      {loading ? <p className="shell-muted" style={{ padding: '8px 12px' }}>Searching…</p> : null}
      {error ? (
        <p className="shell-error" style={{ padding: '8px 12px' }} role="alert">
          {error}
        </p>
      ) : null}
      {!loading && results.length === 0 && !error ? (
        <p className="shell-muted" style={{ padding: 12 }}>No results.</p>
      ) : null}
      <ul className="cmd-palette-list">
        {results.map((hit) => (
          <li key={`${hit.type}:${hit.id}`}>
            <button type="button" className="cmd-palette-item" onClick={() => onSelect(hit)}>
              <span>
                <span className="shell-muted" style={{ marginRight: 8, fontSize: 10 }}>
                  {hit.type}
                </span>
                {hit.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
