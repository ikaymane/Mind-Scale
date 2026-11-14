/** Copy lives in en.json (one place to edit wording) + English number/date formats. */
import en from './en.json';
import type { Lang } from '../store';

type Dict = Record<string, unknown>;
type Vars = Record<string, string | number>;
const LOCALE = 'en-GB';

const lookup = (dict: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Dict)[k] : undefined), dict);
const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;

function makeT() {
  const plural = new Intl.PluralRules(LOCALE);
  const nf = new Intl.NumberFormat(LOCALE);
  const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
  const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
  const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
  const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const raw = (key: string) => lookup(en as Dict, key);

  const t = (key: string, vars?: Vars): string => {
    const v = raw(key);
    return typeof v === 'string' ? fill(v, vars) : key;
  };
  const tv = <T,>(key: string): T => raw(key) as T;
  /** plural: key → { one, other } */
  const tp = (key: string, count: number, vars?: Vars): string => {
    const v = raw(key);
    if (typeof v === 'string') return fill(v, vars);
    if (!v || typeof v !== 'object') return key;
    const forms = v as Record<string, string>;
    return fill(forms[plural.select(count)] ?? forms.other, vars);
  };
  const num = (n: number) => nf.format(n);
  const monthName = (m: number) => monthFmt.format(new Date(Date.UTC(2001, m - 1, 15)));
  const monthShort = (m: number) => monthShortFmt.format(new Date(Date.UTC(2001, m - 1, 15))).replace('Sept', 'Sep');
  const period = (year: number, month: number | null) => (month === null ? String(year) : `${monthName(month)} ${year}`);
  const ofMonth = (m: number) => monthName(m);
  const ratio = (r: number) => (r >= 10 ? nf.format(Math.round(r)) : nf1.format(r));
  const date = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00Z`));
  return { lang: 'en' as Lang, locale: LOCALE, t, tv, tp, num, monthName, monthShort, period, ofMonth, ratio, date, dir: 'ltr' as const };
}

const T = makeT();
export type T = typeof T;
export const useT = (): T => T;
