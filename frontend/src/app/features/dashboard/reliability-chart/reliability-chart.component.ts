import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import type { DailyReliabilityBucket } from '@shared/types';
import { STATUS_COLOR_SCHEME, toStackedBarSeries } from './reliability-chart.mapper';

@Component({
  selector: 'app-reliability-chart',
  standalone: true,
  imports: [NgxChartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <ngx-charts-bar-vertical-stacked
        [view]="[chartWidth(), 320]"
        [results]="series()"
        [scheme]="colorScheme"
        [xAxis]="true"
        [yAxis]="true"
        [legend]="true"
        [showXAxisLabel]="false"
        [showYAxisLabel]="true"
        yAxisLabel="Services"
      />
    </div>
  `,
})
export class ReliabilityChartComponent {
  daily = input.required<DailyReliabilityBucket[]>();
  colorScheme = STATUS_COLOR_SCHEME;

  series = computed(() => toStackedBarSeries(this.daily()));
  // Each day gets ~28px of width so the ~30-day window stays readable; the
  // wrapping div scrolls horizontally rather than squeezing bars illegibly.
  chartWidth = computed(() => Math.max(600, this.daily().length * 28));
}
