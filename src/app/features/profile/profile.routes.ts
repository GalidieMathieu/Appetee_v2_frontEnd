import { Routes } from '@angular/router';
import { ProfilePage } from './profile.page';
import { NutritionProfileEditorFacade } from './state/nutrition-profile-editor.facade';
import { NutritionProfileEditorState } from './state/nutrition-profile-editor.state';
import { nutritionProfilePendingChangesGuard } from './state/nutrition-profile-pending-changes.guard';

export const PROFILE_ROUTES: Routes = [{
  path: '',
  component: ProfilePage,
  canDeactivate: [nutritionProfilePendingChangesGuard],
  providers: [NutritionProfileEditorState, NutritionProfileEditorFacade],
}];
