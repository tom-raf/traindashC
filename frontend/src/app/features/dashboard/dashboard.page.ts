import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { StationCode } from '@shared/types';
import { switchMap } from 'rxjs';
import { TrainDashApiService } from '../../core/api/train-dash-api.service';
import { OperatorSummaryComponent } from './operator-summary/operator-summary.component';
import { ReliabilityChartComponent } from './reliability-chart/reliability-chart.component';
import { StationSelectorComponent } from './station-selector/station-selector.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [StationSelectorComponent, OperatorSummaryComponent, ReliabilityChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl mx-auto p-6 space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-bold text-slate-900">Train Dash</h1>
        <p class="text-slate-500 text-sm">Reliability over the last 30 days</p>
      </header>

      <app-station-selector [stations]="stations() ?? []" [selected]="selectedStation()" (select)="selectedStation.set($event)" />

      @if (selectedStation(); as station) {
        <section class="bg-white rounded-lg border border-slate-200 p-4">
          <h2 class="text-lg font-semibold text-slate-800 mb-3">Reliability</h2>
          <app-reliability-chart [daily]="reliability()?.daily ?? []" />
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold text-slate-800">Train Operators</h2>
          <app-operator-summary [operators]="operatorBreakdown()?.operators ?? []" />
        </section>
      }
    </div>
  `,
})
export class DashboardPage {
  private readonly api = inject(TrainDashApiService);

  selectedStation = signal<StationCode>('CBG');
  private readonly selectedStation$ = toObservable(this.selectedStation);

  stations = toSignal(this.api.getStations());

  reliability = toSignal(this.selectedStation$.pipe(switchMap((station) => this.api.getReliabilitySummary(station))));

  operatorBreakdown = toSignal(
    this.selectedStation$.pipe(switchMap((station) => this.api.getOperatorBreakdown(station))),
  );
}
