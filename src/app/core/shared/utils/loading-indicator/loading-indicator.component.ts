import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  templateUrl: './loading-indicator.component.html',
  styleUrl: './loading-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicatorComponent {
  readonly eyebrow = input('Loading');
  readonly title = input('Preparing content');
  readonly description = input('Please wait while we fetch the latest data.');
  readonly lineCount = input(4, { transform: numberAttribute });

  readonly lines = computed(() => {
    const widths = ['100%', '88%', '94%', '72%', '82%', '64%'];
    const total = Math.max(1, this.lineCount());

    return Array.from({ length: total }, (_, index) => ({
      id: index,
      width: widths[index % widths.length],
    }));
  });
}
