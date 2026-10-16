import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { WeekDateView } from '../models/meal-plan-workspace.model';
import { DatePipe } from '@angular/common';
@Component({ selector: 'app-week-strip', standalone: true, imports: [DatePipe], templateUrl: './week-strip.component.html', styleUrl: './week-strip.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class WeekStripComponent {
    readonly dates = input.required<readonly WeekDateView[]>();
    readonly selected = input.required<string>();
    readonly selectDate = output<string>();
}
