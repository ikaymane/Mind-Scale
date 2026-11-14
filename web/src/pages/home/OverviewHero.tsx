import { useT } from '../../i18n';
import { PeriodPicker } from '../../bulletin/PeriodPicker';
import { useTour } from '../../components/Tour';

export function OverviewHero({ years, period, insight, countryCount, aboveUsual, onOpenMap }: {
  years: number[];
  period: string;
  insight: string;
  countryCount: number;
  aboveUsual: number;
  onOpenMap: () => void;
}) {
  const tt = useT();

  return (
    <section className="overview-hero" data-tour="hero" aria-labelledby="overview-title">
      <div className="overview-hero-copy">
        <p className="overview-eyebrow"><span className="overview-live-dot" aria-hidden="true" />{tt.t('home.kicker')}</p>
        <h1 id="overview-title">{tt.t('home.title')}</h1>
        <p className="overview-lead">{tt.t('home.lead')}</p>

        <div className="overview-actions">
          <button className="overview-action overview-action-primary" onClick={onOpenMap}>
            {tt.t('home.cta')}<span aria-hidden="true">↗</span>
          </button>
          <button className="overview-action overview-action-quiet" onClick={() => useTour.getState().start()}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4.8v10.4L15 10 7 4.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            {tt.t('tour.heroStart')}
          </button>
        </div>

        <div className="overview-insight">
          <span className="overview-insight-mark" aria-hidden="true">↗</span>
          <div>
            <p className="overview-insight-label">{tt.t('home.insightLabel')}</p>
            <p className="overview-insight-text"><strong>{period}</strong><span aria-hidden="true"> · </span>{insight}</p>
          </div>
        </div>
      </div>

      <aside className="overview-period-card" data-tour="period" aria-label={tt.t('home.periodPanel')}>
        <div className="overview-period-card-top">
          <div>
            <p className="overview-period-label">{tt.t('home.pickPeriod')}</p>
            <p className="overview-period-current">{period}</p>
          </div>
          <span className="overview-calendar" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="4.5" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 3v3M13.5 3v3M3.5 8h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </span>
        </div>
        <PeriodPicker years={years} />
        <p className="overview-period-hint">{tt.t('home.periodHint')}</p>
        <div className="overview-period-stats">
          <div><strong>{tt.num(countryCount)}</strong><span>{tt.t('home.countriesCompared')}</span></div>
          <div><strong>{tt.num(aboveUsual)}</strong><span>{tt.t('home.aboveUsualShort')}</span></div>
        </div>
      </aside>
    </section>
  );
}
