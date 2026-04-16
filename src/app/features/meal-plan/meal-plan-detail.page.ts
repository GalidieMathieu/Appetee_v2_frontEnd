import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MealPlanDeleteDialogComponent } from './components/meal-plan-delete.dialog';
import { MealPlanFacade } from './meal-plan.facade';
import { MealPlanDetail } from './meal-plan.model';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule],
  templateUrl: './meal-plan-detail.page.html',
  styleUrl: './meal-plan-detail.page.scss',
})
export class MealPlanDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(MealPlanFacade);
  private readonly dialog = inject(MatDialog);

  readonly detail = signal<MealPlanDetail | null>(null);
  readonly loadState = toSignal(this.facade.state$, { initialValue: 'idle' });
  readonly isLoading = computed(
    () => this.loadState() === 'loading' && this.detail() === null
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      return;
    }

    this.facade.getMealPlanDetail(id).subscribe(detail => this.detail.set(detail));
  }

  openDeleteDialog(): void {
    const detail = this.detail();
    if (!detail) {
      return;
    }

    const dialogRef = this.dialog.open(MealPlanDeleteDialogComponent, {
      data: { mealPlanName: detail.name },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }

      this.facade.deleteMealPlan(detail.id).subscribe(() => {
        this.router.navigate(['/meal-plan']);
      });
    });
  }
}
