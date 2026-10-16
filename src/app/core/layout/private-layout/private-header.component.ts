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
import { UserFacade } from '@app/core/shared/data-access/user/user.facade';
import { CapabilitiesStore } from '@app/core/auth/data-access/capabilities.store';
import { CapabilitiesFacade } from '@app/core/auth/data-access/capabilities.facade';
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
  private readonly userFacade = inject(UserFacade);
  protected readonly capabilities = inject(CapabilitiesStore);
  private readonly capabilityFacade = inject(CapabilitiesFacade);
  private readonly profileUsername = toSignal(this.userFacade.username$, { initialValue: '' });

  readonly username = computed(() => this.profileUsername() || 'Guest');
  readonly userInitial = computed(() => this.username().slice(0, 1).toUpperCase() || 'G');

  isMenuOpen = false;
  activePath = '';

  readonly nav = computed<NavItem[]>(() => [
    { label: 'Home', path: '/home', exact: true },
    { label: 'Recipes', path: '/recipes' },
    { label: 'Favorites', path: '/favorites' },
    { label: 'Profile', path: '/profile' },
    { label: 'Meal Plan', path: '/meal-plan' },
    ...(this.capabilities.canWrite() ? [{ label: 'Create Recipes', path: '/admin-recipes/create' }] : []),
  ]);

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
  @HostListener('window:focus') revalidateCapabilities(): void {
    this.capabilityFacade.refresh$().subscribe({ error: () => undefined });
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
