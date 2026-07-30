import { ScaleType, type Color } from '@swimlane/ngx-charts';
import type { DailyReliabilityBucket } from '@shared/types';

export interface NgxChartsSeriesEntry {
  name: string;
  series: { name: string; value: number }[];
}

// Fixed, pre-validated status palette — not a themed categorical ramp, so it
// intentionally does not go through the generic categorical color validator.
export const STATUS_COLOR_SCHEME: Color = {
  name: 'reliability-status',
  selectable: true,
  group: ScaleType.Ordinal,
  domain: ['#0ca30c', '#fab219', '#d03b3b'],
};

export function toStackedBarSeries(daily: DailyReliabilityBucket[]): NgxChartsSeriesEntry[] {
  return daily.map((bucket) => ({
    name: bucket.date,
    series: [
      { name: 'On Time', value: bucket.onTime },
      { name: 'Delayed', value: bucket.delayed },
      { name: 'Cancelled', value: bucket.cancelled },
    ],
  }));
}
