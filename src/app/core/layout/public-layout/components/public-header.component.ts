import { Component,  output } from "@angular/core";

@Component({
    selector: 'app-public-header',
    templateUrl: './public-header.component.html',
    styleUrls: ['./public-header.component.scss'],
    standalone: true
})
export class PublicHeaderComponent {
    logoClick = output<void>();
}