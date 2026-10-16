import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject } from '@angular/core';
/** Native fragment links resolve against <base href="/">. Focus locally instead of leaving the form. */
@Directive({ selector: 'a[mealPlanFieldLink]', standalone: true, host: { '(click)': 'follow($event)' } })
export class FieldErrorLinkDirective {
  private readonly element = inject<ElementRef<HTMLAnchorElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  follow(event: MouseEvent): void {
    const fragment = this.element.nativeElement.getAttribute('href');
    if (!fragment?.startsWith('#')) return;
    const field = this.document.getElementById(fragment.slice(1));
    if (!field) return;
    event.preventDefault(); field.focus(); field.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }
}
