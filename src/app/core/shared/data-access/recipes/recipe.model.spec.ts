import { IngredientAdminDetailDto } from '../ingredients/ingredient.model';
import { User } from '../user/user.model';
import {
  RecipeCardDto,
  RecipeDetailDto,
  RecipeDiscoveryPageDto,
  RecipeSummaryDto,
} from './recipe.model';

type HasKey<T, Key extends PropertyKey> = Key extends keyof T ? true : false;
type IsExactly<T, Expected> =
  (<Value>() => Value extends T ? 1 : 2) extends
  (<Value>() => Value extends Expected ? 1 : 2)
    ? true
    : false;

describe('recipe image contracts', () => {
  it('uses purpose-specific image properties without a recipe-level imageUrl', () => {
    const explicitImageKeys: [
      HasKey<RecipeCardDto, 'cardImageUrl'>,
      HasKey<RecipeSummaryDto, 'previewImageUrl'>,
      HasKey<RecipeDetailDto, 'previewImageUrl'>,
    ] = [true, true, true];
    const ambiguousImageKeys: [
      HasKey<RecipeCardDto, 'imageUrl'>,
      HasKey<RecipeSummaryDto, 'imageUrl'>,
      HasKey<RecipeDetailDto, 'imageUrl'>,
    ] = [false, false, false];

    expect(explicitImageKeys).toEqual([true, true, true]);
    expect(ambiguousImageKeys).toEqual([false, false, false]);
  });

  it('retains imageUrl on unrelated ingredient and user contracts', () => {
    const unrelatedImageKeys: [
      HasKey<IngredientAdminDetailDto, 'imageUrl'>,
      HasKey<User, 'imageUrl'>,
    ] = [true, true];

    expect(unrelatedImageKeys).toEqual([true, true]);
  });
});

describe('recipe discovery cursor contract', () => {
  it('keeps the continuation cursor opaque and excludes backend cursor internals', () => {
    const nextCursorIsOpaque: IsExactly<
      RecipeDiscoveryPageDto['nextCursor'],
      string | null
    > = true;
    const backendCursorKeys: [
      HasKey<RecipeDiscoveryPageDto, 'seed'>,
      HasKey<RecipeDiscoveryPageDto, 'rank'>,
      HasKey<RecipeDiscoveryPageDto, 'recipeId'>,
      HasKey<RecipeDiscoveryPageDto, 'criteriaFingerprint'>,
    ] = [false, false, false, false];

    expect(nextCursorIsOpaque).toBe(true);
    expect(backendCursorKeys).toEqual([false, false, false, false]);
  });
});
