import { Component, ChangeDetectionStrategy, input } from "@angular/core";

@Component({
    selector:'app-step-item',
    standalone: true,
    templateUrl: './step-item.component.html',
    styleUrl : './step-item.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepItemComponent{
    step_number  = input.required<string>();
    title = input.required<string>();
    description = input.required<string>();
} 