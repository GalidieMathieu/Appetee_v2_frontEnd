/** Exercises accessible profile editing and current-account closure without client-selected identity. */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { ProfilePage } from './profile.page';
import { Router } from '@angular/router';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  const errorSubject = new BehaviorSubject<string | null>(null);
  const getMe = vi.fn();
  const updateMe = vi.fn();
  const deleteMe = vi.fn();
  const navigateByUrl = vi.fn(() => Promise.resolve(true));

  beforeEach(async () => {
    getMe.mockReset();
    updateMe.mockReset();
    deleteMe.mockReset();
    navigateByUrl.mockClear();
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
    imageControl.markAsTouched();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#profile-image-url') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('image-url-error');
    expect(fixture.nativeElement.textContent).toContain('Enter a complete HTTP or HTTPS URL.');
  });

  it('shows a retryable missing-account error', () => {
    errorSubject.next('The requested resource was not found.');
    getMe.mockReturnValue(throwError(() => new Error('missing')));

    fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The requested resource was not found.');
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Try again');
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
