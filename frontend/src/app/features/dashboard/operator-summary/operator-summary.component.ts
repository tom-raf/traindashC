import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { OperatorBreakdownEntry } from '@shared/types';

@Component({
  selector: 'app-operator-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-full text-sm text-left">
        <thead class="bg-slate-50 text-slate-600 uppercase text-xs">
          <tr>
            <th class="px-4 py-2">Operator</th>
            <th class="px-4 py-2 text-right">Services</th>
            <th class="px-4 py-2 text-right">On Time</th>
            <th class="px-4 py-2 text-right">Delayed</th>
            <th class="px-4 py-2 text-right">Cancelled</th>
            <th class="px-4 py-2 text-right">On Time %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          @for (entry of operators(); track entry.operator.code) {
            <tr>
              <td class="px-4 py-2 font-medium text-slate-900">{{ entry.operator.name }}</td>
              <td class="px-4 py-2 text-right">{{ entry.totalServices }}</td>
              <td class="px-4 py-2 text-right">{{ entry.onTime }}</td>
              <td class="px-4 py-2 text-right">{{ entry.delayed }}</td>
              <td class="px-4 py-2 text-right">{{ entry.cancelled }}</td>
              <td class="px-4 py-2 text-right font-semibold">{{ entry.onTimePercentage }}%</td>
            </tr>
          } @empty {
            <tr>
              <td class="px-4 py-4 text-slate-400 text-center" colspan="6">No data for this station yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class OperatorSummaryComponent {
  operators = input.required<OperatorBreakdownEntry[]>();
}
