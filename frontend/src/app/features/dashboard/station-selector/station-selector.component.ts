import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StationCode, StationInfo } from '@shared/types';

@Component({
  selector: 'app-station-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-2">
      @for (station of stations(); track station.code) {
        <button
          type="button"
          class="px-4 py-2 rounded-md text-sm font-medium border transition-colors"
          [class.bg-slate-900]="station.code === selected()"
          [class.text-white]="station.code === selected()"
          [class.border-slate-900]="station.code === selected()"
          [class.bg-white]="station.code !== selected()"
          [class.text-slate-700]="station.code !== selected()"
          [class.border-slate-300]="station.code !== selected()"
          (click)="select.emit(station.code)"
        >
          {{ station.name }}
        </button>
      }
    </div>
  `,
})
export class StationSelectorComponent {
  stations = input.required<StationInfo[]>();
  selected = input.required<StationCode | null>();
  select = output<StationCode>();
}
