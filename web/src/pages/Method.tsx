import { useT } from '../i18n';
import type { Dataset } from '../lib/data';
import { LevelLegend } from '../components/Level';
import { CleaningTable } from '../components/CleaningTable';

interface Section { title: string; body: string[]; levels?: boolean; cleaning?: boolean; after?: string[] }
interface Source { name: string; detail: string; url: string }

export function Method({ data }: { data: Dataset }) {
  const tt = useT();
  const sections = tt.tv<Section[]>('method.sections');
  const cleaning = data.meta.cleaning ?? {};

  return (
    <main className="prose-page" id="main">
      <h1>{tt.t('method.title')}</h1>
      <p className="lead">{tt.t('method.intro')}</p>

      {sections.map((s) => (
        <details className="method-section" key={s.title} data-tour={s.cleaning ? 'method' : undefined}>
          <summary><span role="heading" aria-level={2} className="method-section-title">{s.title}</span></summary>
          <div className="method-section-content">
            {s.body.map((p, i) => <p key={i}>{p}</p>)}
            {s.levels && <LevelLegend long />}
            {s.cleaning && Object.keys(cleaning).length > 0 && (
              <div>
                <h3>{tt.t('method.cleaningTitle')}</h3>
                {Object.entries(cleaning).flatMap(([sensor, byIso]) => Object.entries(byIso ?? {}).map(([iso, c]) => {
                  const country = data.regions.find((r) => r.country === iso);
                  const caption = `${country ? country.name_en : iso} · ${sensor}${c.satellites ? ` (${c.satellites})` : ''}`;
                  return <CleaningTable key={`${sensor}|${iso}`} steps={c.steps} caption={caption} />;
                }))}
              </div>
            )}
            {s.after?.map((p, i) => <p key={`a${i}`}>{p}</p>)}
          </div>
        </details>
      ))}

      <details className="method-section method-sources">
        <summary><span role="heading" aria-level={2} className="method-section-title">{tt.t('method.sourcesTitle')}</span></summary>
        <div className="method-section-content">
          <ul className="sources">
            {tt.tv<Source[]>('method.sources').map((s) => (
              <li key={s.name}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> — {s.detail}
              </li>
            ))}
          </ul>
          <p className="muted">{tt.t('method.thanks')}</p>
        </div>
      </details>
    </main>
  );
}
