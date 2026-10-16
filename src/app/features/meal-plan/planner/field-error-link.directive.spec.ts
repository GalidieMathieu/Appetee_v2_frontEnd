import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldErrorLinkDirective } from './field-error-link.directive';
@Component({ standalone: true, imports: [FieldErrorLinkDirective], template: '<input id="test-error-field"/><a mealPlanFieldLink href="#test-error-field">Correct field</a>' })
class Host {}
describe('Local error summary links', () => {
  it('focuses the existing field and prevents base-href navigation away from the draft', () => {
    const fixture = TestBed.createComponent(Host); fixture.detectChanges();
    const click = new MouseEvent('click', { cancelable: true, bubbles: true }); fixture.nativeElement.querySelector('a').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true); expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input'));
  });
});
