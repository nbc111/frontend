import type { ApiResource } from '../types';
import type * as stats from '@blockscout/stats-types';

export const STATS_API_RESOURCES = {
  counters: {
    path: '/api/v2/stats',
  },
  lines: {
    path: '/api/v2/stats/charts/transactions',
  },
  line: {
    path: '/api/v2/stats/charts/transactions',
    pathParams: [ 'id' as const ],
  },
  pages_main: {
    path: '/api/v2/main-page/blocks',
  },
  pages_transactions: {
    path: '/api/v2/main-page/transactions',
  },
  pages_contracts: {
    path: '/api/v2/main-page/contracts',
  },
} satisfies Record<string, ApiResource>;

export type StatsApiResourceName = `stats:${ keyof typeof STATS_API_RESOURCES }`;

/* eslint-disable @stylistic/indent */
export type StatsApiResourcePayload<R extends StatsApiResourceName> =
R extends 'stats:counters' ? stats.Counters :
R extends 'stats:lines' ? stats.LineCharts :
R extends 'stats:line' ? stats.LineChart :
R extends 'stats:pages_main' ? stats.MainPageStats :
R extends 'stats:pages_transactions' ? stats.TransactionsPageStats :
R extends 'stats:pages_contracts' ? stats.ContractsPageStats :
never;
/* eslint-enable @stylistic/indent */
