import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { ProfilePage } from '../profile.page';
import { NutritionProfileEditorFacade } from './nutrition-profile-editor.facade';

export const nutritionProfilePendingChangesGuard: CanDeactivateFn<ProfilePage> = () => {
  const editor = inject(NutritionProfileEditorFacade);
  if (!editor.hasPendingChanges()) return true;
  if (editor.saving() || editor.requiresReview()) return false;

  const browserWindow = inject(DOCUMENT).defaultView;
  const discard = browserWindow?.confirm(
    'Discard the unsaved nutrition profile changes and leave this page?'
  ) ?? false;
  if (discard) editor.discard();
  return discard;
};
