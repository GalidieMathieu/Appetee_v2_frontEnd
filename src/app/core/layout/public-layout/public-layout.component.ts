import { Component } from "@angular/core";
import { Router, RouterOutlet } from "@angular/router";
import { PublicHeaderComponent } from "./components/public-header.component";

@Component({
    selector: 'app-public-layout',
    templateUrl: './public-layout.component.html',
    styleUrls: ['./public-layout.component.scss'],
    standalone: true,
    imports: [RouterOutlet, PublicHeaderComponent]
})
export class PublicLayoutComponent {
    constructor(private router: Router) {}
    onLogoClick() : void{
        this.router.navigateByUrl('/');
    }
}