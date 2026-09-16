import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, take } from 'rxjs';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { User } from '@app/core/shared/data-access/user/user.model';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly userFacade = inject(UserFacade);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly hasProfile = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    imageUrl: new FormControl('', {
      nonNullable: true,
      validators: [this.optionalHttpUrlValidator],
    }),
  });

  constructor() {
    this.loadProfile();
  }

  submit(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.userFacade.updateMe$({
      username: value.username.trim(),
      imageUrl: value.imageUrl.trim() || null,
    }).pipe(
      take(1),
      finalize(() => this.isSubmitting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => {
        this.populateForm(profile);
        this.successMessage.set('Your profile has been updated.');
      },
      error: () => this.readFacadeError(),
    });
  }

  private loadProfile(): void {
    this.isLoading.set(true);
    this.hasProfile.set(false);
    this.errorMessage.set(null);
    this.userFacade.getMe$().pipe(
      take(1),
      finalize(() => this.isLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: profile => this.populateForm(profile),
      error: () => this.readFacadeError(),
    });
  }

  retry(): void {
    this.loadProfile();
  }

  private populateForm(profile: User): void {
    this.form.reset({
      username: profile.username,
      imageUrl: profile.imageUrl ?? '',
    });
    this.hasProfile.set(true);
  }

  private readFacadeError(): void {
    this.userFacade.error$.pipe(take(1)).subscribe(message => {
      this.errorMessage.set(message ?? 'Something went wrong. Please try again.');
    });
  }

  private optionalHttpUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value.trim();
    if (!value) return null;

    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? null : { invalidUrl: true };
    } catch {
      return { invalidUrl: true };
    }
  }
}
