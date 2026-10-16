/** Presents claim-scoped profile editing and explicit, retryable current-account closure. */
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NutritionProfileFormComponent } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.component';
import { NutritionProfileEditorFacade } from './state/nutrition-profile-editor.facade';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, NutritionProfileFormComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnDestroy {
  readonly nutritionEditor = inject(NutritionProfileEditorFacade);
  readonly isLoading = this.nutritionEditor.isAccountLoading;
  readonly isSubmitting = this.nutritionEditor.isAccountSubmitting;
  readonly hasProfile = this.nutritionEditor.hasAccountProfile;
  readonly errorMessage = this.nutritionEditor.accountErrorMessage;
  readonly successMessage = this.nutritionEditor.accountSuccessMessage;
  readonly isDeleteConfirmationOpen = this.nutritionEditor.isDeleteConfirmationOpen;
  readonly isDeleting = this.nutritionEditor.isDeleting;
  readonly deleteErrorMessage = this.nutritionEditor.deleteErrorMessage;
  readonly form = this.nutritionEditor.accountForm;
  readonly deleteForm = this.nutritionEditor.deleteForm;

  constructor() {
    this.nutritionEditor.enter();
  }

  ngOnDestroy(): void {
    this.nutritionEditor.leave();
  }

  submit(): void {
    this.nutritionEditor.saveAccountProfile();
  }

  retry(): void {
    this.nutritionEditor.retryAccountLoad();
  }

  openDeleteConfirmation(): void {
    this.nutritionEditor.openDeleteConfirmation();
  }

  cancelDeleteConfirmation(): void {
    this.nutritionEditor.cancelDeleteConfirmation();
  }

  /**
   * Sends no account identifier and leaves the confirmation retryable unless the server confirms success.
   */
  deleteAccount(): void {
    this.nutritionEditor.deleteAccount();
  }
}
