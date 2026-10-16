/** Exercises accessible profile editing and current-account closure without client-selected identity. */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { ProfilePage } from './profile.page';
import { Router } from '@angular/router';
import { createNutritionProfileForm } from '@app/core/shared/ui/nutrition-profile-form/nutrition-profile-form.factory';
import { NutritionProfileEditorFacade } from './state/nutrition-profile-editor.facade';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  const errorSubject = new BehaviorSubject<string | null>(null);
  const getMe = vi.fn();
  const updateMe = vi.fn();
  const deleteMe = vi.fn();
  const navigateByUrl = vi.fn((_url?: string, _options?: unknown) => Promise.resolve(true));
  const nutritionEditor = {
    form: createNutritionProfileForm({
      calculationSex: 'female',
      birthYear: 1990,
      heightCm: 168.5,
      weightKg: 64.25,
    }, 2026),
    loading: signal(false),
    saving: signal(false),
    initialized: signal(true),
    errorMessage: signal<string | null>(null),
    successMessage: signal<string | null>(null),
    fieldErrors: signal({}),
    queryError: signal<string | null>(null),
    requiresReview: signal(false),
    refreshedRevision: signal<string | null>(null),
    diagnostic: signal<string | null>(null),
    savedProfile: signal(null),
    confirmReview: vi.fn(),
    leave: vi.fn(),
    isAccountLoading: signal(false),
    isAccountSubmitting: signal(false),
    hasAccountProfile: signal(true),
    accountErrorMessage: signal<string | null>(null),
    accountSuccessMessage: signal<string | null>(null),
    isDeleteConfirmationOpen: signal(false),
    isDeleting: signal(false),
    deleteErrorMessage: signal<string | null>(null),
    accountForm: new FormGroup({
      username: new FormControl('chef', { nonNullable: true, validators: [Validators.required] }),
      imageUrl: new FormControl('', { nonNullable: true }),
    }),
    deleteForm: new FormGroup({
      confirmation: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^DELETE$/)],
      }),
    }),
    enter: vi.fn(),
    retryLoad: vi.fn(),
    save: vi.fn(),
    retryAccountLoad: vi.fn(),
    saveAccountProfile: vi.fn(),
    openDeleteConfirmation: vi.fn(),
    cancelDeleteConfirmation: vi.fn(),
    deleteAccount: vi.fn(),
  };

  beforeEach(async () => {
    getMe.mockReset();
    updateMe.mockReset();
    deleteMe.mockReset();
    navigateByUrl.mockClear();
    nutritionEditor.enter.mockClear();
    nutritionEditor.save.mockClear();
    nutritionEditor.accountForm.reset({ username: 'chef', imageUrl: '' });
    nutritionEditor.deleteForm.reset();
    nutritionEditor.accountSuccessMessage.set(null);
    nutritionEditor.accountErrorMessage.set(null);
    nutritionEditor.hasAccountProfile.set(true);
    nutritionEditor.isAccountLoading.set(false);
    nutritionEditor.isDeleteConfirmationOpen.set(false);
    nutritionEditor.openDeleteConfirmation.mockImplementation(() => {
      nutritionEditor.isDeleteConfirmationOpen.set(true);
    });
    nutritionEditor.cancelDeleteConfirmation.mockImplementation(() => {
      nutritionEditor.isDeleteConfirmationOpen.set(false);
    });
    nutritionEditor.saveAccountProfile.mockImplementation(() => {
      const value = nutritionEditor.accountForm.getRawValue();
      updateMe({
        username: value.username.trim(),
        imageUrl: value.imageUrl.trim() || null,
      }).subscribe({
        next: () => nutritionEditor.accountSuccessMessage.set('Your profile has been updated.'),
      });
    });
    nutritionEditor.deleteAccount.mockImplementation(() => {
      deleteMe().subscribe({
        next: () => void navigateByUrl('/auth/login', { replaceUrl: true }),
        error: () => nutritionEditor.deleteErrorMessage.set(errorSubject.value),
      });
    });
    errorSubject.next(null);
    getMe.mockReturnValue(of({ username: 'chef', imageUrl: null }));

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        {
          provide: UserFacade,
          useValue: {
            getMe$: getMe,
            updateMe$: updateMe,
            deleteMe$: deleteMe,
            error$: errorSubject.asObservable(),
          },
        },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: NutritionProfileEditorFacade, useValue: nutritionEditor },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
  });

  it('loads the current profile and submits no owner identifier', () => {
    updateMe.mockReturnValue(of({
      username: 'new-chef',
      imageUrl: 'https://example.com/avatar.png',
    }));
    fixture.componentInstance.form.setValue({
      username: ' new-chef ',
      imageUrl: ' https://example.com/avatar.png ',
    });

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    fixture.detectChanges();

    expect(updateMe).toHaveBeenCalledWith({
      username: 'new-chef',
      imageUrl: 'https://example.com/avatar.png',
    });
    expect(fixture.nativeElement.textContent).toContain('Your profile has been updated.');
  });

  it('associates client-side validation feedback with its input', () => {
    const imageControl = fixture.componentInstance.form.controls.imageUrl;
    imageControl.setValue('javascript:alert(1)');
    imageControl.setErrors({ invalidUrl: true });
    imageControl.markAsTouched();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#profile-image-url') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('image-url-error');
    expect(fixture.nativeElement.textContent).toContain('Enter a complete HTTP or HTTPS URL.');
  });

  it('shows a retryable missing-account error', () => {
    nutritionEditor.hasAccountProfile.set(false);
    nutritionEditor.accountErrorMessage.set('The requested resource was not found.');

    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The requested resource was not found.');
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Try again');
  });

  it('keeps username/image editing and the separate controlled nutrition form on one page', () => {
    expect(nutritionEditor.enter).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Nutrition profile');
    expect(fixture.nativeElement.querySelector('#profile-username')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#nutrition-height')).not.toBeNull();
  });

  it('requires the exact confirmation text before requesting account deletion', () => {
    clickButton('Delete account');
    fixture.detectChanges();

    const confirmButton = buttonByText('Permanently delete account');
    expect(confirmButton.disabled).toBe(true);

    fixture.componentInstance.deleteForm.controls.confirmation.setValue('delete');
    fixture.detectChanges();
    expect(confirmButton.disabled).toBe(true);

    fixture.componentInstance.deleteForm.controls.confirmation.setValue('DELETE');
    fixture.detectChanges();
    expect(confirmButton.disabled).toBe(false);
  });

  it('deletes only the current account and replaces the protected route after success', () => {
    deleteMe.mockReturnValue(of(void 0));
    openValidDeleteConfirmation();

    buttonByText('Permanently delete account').click();
    fixture.detectChanges();

    expect(deleteMe).toHaveBeenCalledWith();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
  });

  it('keeps failed deletion retryable and does not navigate away', () => {
    errorSubject.next('An internal server error occurred. Please try again.');
    deleteMe.mockReturnValue(throwError(() => new Error('delete failed')));
    openValidDeleteConfirmation();

    buttonByText('Permanently delete account').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'An internal server error occurred. Please try again.'
    );
    expect(buttonByText('Permanently delete account').disabled).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  function openValidDeleteConfirmation(): void {
    clickButton('Delete account');
    fixture.componentInstance.deleteForm.controls.confirmation.setValue('DELETE');
    fixture.detectChanges();
  }

  function clickButton(text: string): void {
    buttonByText(text).click();
  }

  function buttonByText(text: string): HTMLButtonElement {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(candidate => candidate.textContent?.trim() === text);
    if (!button) throw new Error(`Missing button: ${text}`);
    return button;
  }
});
