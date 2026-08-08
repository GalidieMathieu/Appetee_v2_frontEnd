import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LandingPageComponent } from './landing.page';

@Component({
  standalone: true,
  template: '<p>Dummy Page</p>',
})
class DummyPageComponent {}

describe('LandingPageComponent', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [
        provideRouter([
          { path: '', component: LandingPageComponent },
          { path: 'auth/sign-up', component: DummyPageComponent },
          { path: 'auth/login', component: DummyPageComponent },
        ]),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
  });

  // Verifies that the root landing route renders the main hero copy and onboarding section titles.
  it('renders the landing content for the root route', async () => {
    await harness.navigateByUrl('/', LandingPageComponent);

    const text = harness.routeNativeElement?.textContent ?? '';

    expect(text).toContain('Discover Recipes');
    expect(text).toContain('Made For You');
    expect(text).toContain('How It Works');
    expect(text).toContain('Your Personalized Recipes');
  });

  // Verifies that the primary landing page call-to-action links point to the sign-up and login flows.
  it('exposes authentication calls to action from the landing page', async () => {
    await harness.navigateByUrl('/', LandingPageComponent);

    const links = Array.from(harness.routeNativeElement?.querySelectorAll('a') ?? []);
    const hrefs = links.map(link => link.getAttribute('href'));
    const linkText = links.map(link => link.textContent?.trim() ?? '');

    expect(hrefs).toContain('/auth/sign-up');
    expect(hrefs).toContain('/auth/login');
    expect(linkText).toContain('Get Started');
    expect(linkText).toContain('Already have an account?');
  });
});
