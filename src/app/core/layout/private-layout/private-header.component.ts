import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  HostListener,
  inject,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthFacade } from '@app/core/auth/data-access/auth.facade';
import { finalize } from 'rxjs';
import { filter } from 'rxjs/operators';

type NavItem = {
  label: string;
  path: string;
  exact?: boolean;
};

@Component({
  selector: 'app-private-header',
  templateUrl: './private-header.component.html',
  styleUrls: ['./private-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
})
export class PrivateHeaderComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly session = toSignal(this.authFacade.data$, { initialValue: null });

  readonly username = computed(() => this.session()?.username ?? 'Guest');
  readonly userInitial = computed(() => this.username().slice(0, 1).toUpperCase() || 'G');

  isMenuOpen = false;
  activePath = '';

  nav: NavItem[] = [
    { label: 'Home', path: '/home', exact: true },
    { label: 'Recipes', path: '/recipes' },
    { label: 'Diet & Needs', path: '/diet-needs' },
    { label: 'Profile', path: '/profile' },
    { label: 'Create Recipes', path: '/admin-recipes/create' },
    { label: 'Meal plan', path: '/meal-plan' },

  ];

  constructor(private readonly router: Router) {
    this.activePath = this.router.url;

    // Close menu on navigation (mobile)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.activePath = (e as NavigationEnd).urlAfterRedirects;
        this.isMenuOpen = false;
      });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  goTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  goToCreateRecipe(): void {
    void this.router.navigateByUrl('/recipes/create');
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.isMenuOpen = false;
  }

  onLogoClick(): void {
    void this.router.navigateByUrl('/home');
  }

  logout(): void {
    this.authFacade.logout()
      .pipe(
        finalize(() => {
          void this.router.navigateByUrl('/auth/login');
        })
      )
      .subscribe();
  }
}
