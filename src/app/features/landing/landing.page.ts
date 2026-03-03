import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureItemComponent } from "./components/feature-item.component";
import { StepItemComponent } from "./components/step-item.component";

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [RouterLink, FeatureItemComponent, StepItemComponent]
})
export class LandingPageComponent {
    title: string = "Discover Recipes";
    title_p2: string = "Made For You";
    subtitle: string = "Get personalized recipe recommendations based on your dietary preferences, ingredients you own, and meal prepeartion style.";
    buttonLoginTitle : string = "Already have an account?";
    buttonSignUpTitle: string = "Get Started";

    //right side Card
    title_card : string = "Your Personalized Recipes";
    diet_1 : string = "Vegetarian";
    diet_2 : string = "Low-carb";
    StepsTitle : string = "How It Works";
    //all the feature for the front
    features = [
      {
        iconSrc: '/assets/icons/leaf.png',
        iconAlt: 'leaf',
        title: 'Personalized by Diet',
        description: 'Recipes tailored to your dietary preferences.',
      },
      {
        iconSrc: '/assets/icons/fire.png',
        iconAlt: 'fire',
        title: 'Smart Ingredients',
        description: 'Recipes that avoid your disliked ingredients.',
      },
      { 
        iconSrc: '/assets/icons/clock.png',
        iconAlt: 'Clock',
        title: 'Flexible Prep',
        description: 'Batch prep recipes or daily meal plans.',
      },
      {
        iconSrc: '/assets/icons/heart.png',
        iconAlt: 'heart',
        title: 'Community Favorites',
        description: 'Save and share recipes with other food lovers.',
      },
    ] as const;

    //all the steps for the front
    steps = [
      {
        step_number: '1',
        title: 'Create Profile',
        description: 'Set up your account and tell us about your dietary preferences',
      },
      {
        step_number: '2',
        title: 'Choose Preferences',
        description: 'Select ingredients you dislike and meal prep style',
      },
      { 
        step_number: '3',
        title: 'Find Recipes',
        description: 'Get personalized recipes tailored just for you',
      },
    ] as const;
}
