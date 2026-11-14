import { useId, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, type Region } from '../lib/data';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '').toLowerCase().replace(/[-'’\s]+/g, ' ').trim();

/** Combobox accessible : cherche dans les noms FR / AR / EN. */
export function RegionSearch({ regions, big = false, onPicked }: { regions: Region[]; big?: boolean; onPicked?: () => void }) {
  const { t, lang } = useT();
  const set = useApp((s) => s.set);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const nq = norm(q);
    const list = nq
      ? regions.filter((r) => [r.name_fr, r.name_ar, r.name_en, r.region_id].some((n) => n && norm(n).includes(nq)))
      : regions;
    return list.slice(0, 8);
  }, [q, regions]);

  const pick = (r: Region) => {
    set({ regionId: r.region_id, page: 'app' });
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onPicked?.();
  };

  return (
    <div className={`search ${big ? 'search-big' : ''}`}>
      <label className="sr-only" htmlFor={`${listId}-in`}>{t('search.label')}</label>
      <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        id={`${listId}-in`}
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].region_id}` : undefined}
        autoComplete="off"
        placeholder={t('search.placeholder')}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul className="search-list" id={listId} role="listbox">
          {results.length === 0 && <li className="search-empty">{t('search.none')}</li>}
          {results.map((r, i) => (
            <li
              key={r.region_id}
              id={`${listId}-${r.region_id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{regionName(r, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
