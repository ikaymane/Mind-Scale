import { useT } from '../i18n';

/** Raw file to analysed detections: what each cleaning step kept and removed. Reads whatever steps meta.json declares. */
export function CleaningTable({ steps, caption, className = '' }: { steps: [string, number][]; caption?: string; className?: string }) {
  const tt = useT();
  const cols = tt.tv<string[]>('method.cleaningCols');
  return (
    <div className="table-wrap">
      <table className={className}>
        {caption && <caption>{caption}</caption>}
        <thead><tr>{cols.map((c, i) => <th key={c} scope="col" className={i ? 'num' : undefined}>{c}</th>)}</tr></thead>
        <tbody>
          {steps.map(([key, n], i) => {
            const removed = i === 0 ? 0 : steps[i - 1][1] - n;
            const label = tt.t(`cleaning.${key}`);
            return (
              <tr key={key}>
                <th scope="row">{label === `cleaning.${key}` ? key : label}</th>
                <td className="num">{tt.num(n)}</td>
                <td className="num">{i === 0 ? '—' : `${tt.num(removed)} (${tt.num(Math.round((1000 * removed) / steps[i - 1][1]) / 10)} %)`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
