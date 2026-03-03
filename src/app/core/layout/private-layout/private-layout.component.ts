import { ChangeDetectionStrategy, Component } from '@angular/core';
import {RouterOutlet } from '@angular/router';
import { PrivateHeaderComponent } from './private-header.component';

@Component({
  selector: 'app-private-layout',
  template: `
    <app-private-header></app-private-header>
    <main class="private-layout_main">
      <router-outlet></router-outlet>
    </main>
  `,
  styleUrls: ['./private-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet, PrivateHeaderComponent],
})
export class PrivateLayoutComponent 
{ 
  
}