# Frontend state ownership

Every new state object must declare its owner, lifetime, invalidation event, and whether it is
identity-scoped. HTTP remains Observable-based; new shared state should use signals and computed
selectors.

| Class | Lifetime | Provider | Examples | Reset/invalidation |
|---|---|---|---|---|
| Session/application | Current identity | Root | `AuthStore`, `UserStore` | Logout, failed restore, identity change |
| Complete entity cache | Current identity | Root and registered in `SESSION_RESETTERS` | `RecipeDetailsStore`, `IngredientDetailsStore` | Identity reset, explicit id invalidation, confirmed admin mutation |
| Query/list | Owner of the result set | Feature/domain | `RecipesStore` catalogue cards | Query change, dependent mutation, owner reset |
| Temporary flow | Routed page/flow | Route or persistent shell | `SignUpWizard`, admin recipe form | Owning route/shell destruction |

`EntityStore<T>` is only for a complete whole-value/load-once snapshot, such as diets, users,
authentication, or the current bounded catalogue query. It must not represent independently loaded
entities. `EntityCacheStore<TEntity>` is the signal-backed ID cache for that purpose.

## Current inventory

| Store/state | Classification | Identity-scoped | Notes |
|---|---|---:|---|
| `AuthStore` | Session | Yes | Cookie-backed session; no browser credential storage |
| `UserStore` | Session | Yes | Current user only |
| `DietsStore` | Whole-value catalogue | Registered for reset | Complete reference snapshot |
| `IngredientsStore` | Whole-value lightweight catalogue | Registered for reset | IDs and names only; never admin details |
| `IngredientDetailsStore` | Complete entity cache | Yes | Lazy, memory-only, per-ID request/error state |
| `AdminIngredientStore` | Admin mutation request state | Registered for reset | Independent of catalogue/detail loading |
| `RecipesStore` | Recipe catalogue query/list | Registered for reset | Lightweight card results only; never complete details |
| `RecipeDetailsStore` | Complete entity cache | Yes | Lazy, memory-only, per-ID request state |
| `AdminRecipeStore` | Admin mutation request state | Registered for reset | Independent of catalogue/detail loading |
| `SignUpWizard` | Temporary flow | No | Route-scoped and destroyed on leaving sign-up |
| Admin recipe form/signals | Temporary page | No | Component-owned and destroyed on navigation |
| Recipe browse filters/signals | Temporary page/query parameters | No | Component-owned; do not clear recipe detail cache |
| Signup email availability | Temporary operation | No | Shell-owned loading/error; never changes `UserStore` state |

## Domain folder convention

Keep normal domain contracts and catalogue/detail access at the domain root. Put privileged mutation
and admin-only detail access under an `admin/` child so the boundary remains visible as domains grow:

```text
recipes/
  recipe.api.ts
  recipe.facade.ts
  recipe.model.ts
  recipes.store.ts
  recipe-details.store.ts
  admin/
    admin-recipe.api.ts
    admin-recipe.facade.ts
    admin-recipe.store.ts

ingredients/
  ingredient.api.ts
  ingredient.facade.ts
  ingredient.model.ts
  ingredients.store.ts
  admin/
    admin-ingredient.api.ts
    admin-ingredient.facade.ts
    admin-ingredient.store.ts
    ingredient-details.facade.ts
    ingredient-details.store.ts
```

## Feature review contract

Data-heavy feature specifications must answer:

1. Is each object session state, a complete entity, a query/list projection, or temporary flow state?
2. Who provides it and how long does it live?
3. What invalidates it, and does a successful mutation update or invalidate one source of truth?
4. If it is identity-scoped, which `SESSION_RESETTERS` registration clears it?
5. Can unrelated IDs/queries load independently, and are duplicate same-key requests bounded?

Recipe cards use `RecipeCardDto`; complete detail consumers use `RecipeDetailDto`; admin forms use
`RecipeDetailRequest`. Favorite membership remains a separate user relationship source of truth when
that feature is introduced. Meal-plan and preference mutations must invalidate their dependent Home
queries rather than mutating recipe entities.

## Request-state rule

Catalogue/query requests, detail requests, and mutations never share a loading or error flag. A
catalogue has one request state for that complete result. Entity caches have request state per ID.
Each mutation workflow has its own request state. Starting or completing one operation must not clear,
replace, or block an unrelated operation's error/loading state. Same-key detail requests are coalesced;
different IDs remain concurrent.

Reset increments the entity cache generation. Facades discard responses and errors from older
generations so a request started before logout or identity change cannot repopulate or emit from the
new identity's cache.
