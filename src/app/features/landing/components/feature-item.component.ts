import { Component, ChangeDetectionStrategy, input } from "@angular/core";

@Component({
    selector:'app-feature-item',
    standalone: true,
    templateUrl: './feature-item.component.html',
    styleUrl : './feature-item.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureItemComponent{
    title  = input.required<string>();
    description = input.required<string>();

    iconSrc = input.required<string>();
    iconAlt = input<string>('');
} 