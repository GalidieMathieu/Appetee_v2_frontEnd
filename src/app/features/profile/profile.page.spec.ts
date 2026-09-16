import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  const errorSubject = new BehaviorSubject<string | null>(null);
  const getMe = vi.fn();
  const updateMe = vi.fn();

  beforeEach(async () => {
    getMe.mockReset();
    updateMe.mockReset();
    errorSubject.next(null);
    getMe.mockReturnValue(of({ username: 'chef', imageUrl: null }));

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [{
        provide: UserFacade,
        useValue: { getMe$: getMe, updateMe$: updateMe, error$: errorSubject.asObservable() },
      }],
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
});
