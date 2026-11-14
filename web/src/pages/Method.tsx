import { useT } from '../i18n';
import type { Dataset } from '../lib/data';
import { LevelLegend } from '../components/Level';

interface Section { title: string; body: string[]; levels?: boolean; cleaning?: boolean; after?: string[] }
interface Source { name: string; detail: string; url: string }

export function Method({ data }: { data: Dataset }) {
  const tt = useT();
  const sections = tt.tv<Section[]>('method.sections');
  const cols = tt.tv<string[]>('method.cleaningCols');
  const cleaning = data.meta.cleaning ?? {};

  return (
    <main className="prose-page" id="main">
      <h1>{tt.t('method.title')}</h1>
      <p className="lead">{tt.t('method.intro')}</p>

      {sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.body.map((p, i) => <p key={i}>{p}</p>)}
          {s.levels && <LevelLegend long />}
          {s.cleaning && Object.keys(cleaning).length > 0 && (
            <>
              <h3>{tt.t('method.cleaningTitle')}</h3>
              {Object.entries(cleaning).map(([iso, c]) => {
                const country = data.regions.find((r) => r.country === iso);
                return (
                  <div className="table-wrap" key={iso}>
                    <table>
                      <caption>{country ? country.name_en : iso}</caption>
                      <thead><tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                      <tbody>
                        {c.steps.map(([key, n], i) => {
                          const removed = i === 0 ? 0 : c.steps[i - 1][1] - n;
                          return (
                            <tr key={key}>
                              <th scope="row">{tt.t(`cleaning.${key}`)}</th>
                              <td>{tt.num(n)}</td>
                              <td>{i === 0 ? '—' : `${tt.num(removed)} (${tt.num(Math.round((1000 * removed) / c.steps[i - 1][1]) / 10)} %)`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </>
          )}
          {s.after?.map((p, i) => <p key={`a${i}`}>{p}</p>)}
        </section>
      ))}

      <section>
        <h2>{tt.t('method.sourcesTitle')}</h2>
        <ul className="sources">
          {tt.tv<Source[]>('method.sources').map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> — {s.detail}
            </li>
          ))}
        </ul>
        <p className="muted">{tt.t('method.thanks')}</p>
      </section>
    </main>
  );
}
