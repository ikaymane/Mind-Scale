import type { Region } from '../../lib/data';
import type { Verdict } from '../../lib/stats';

export interface CountryMonthSummary {
  region: Region;
  verdict: Verdict;
}
