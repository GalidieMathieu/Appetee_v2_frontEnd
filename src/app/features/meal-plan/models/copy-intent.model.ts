import { Signal } from '@angular/core';
export type CopyMode = 'day' | 'week';
export interface CopyDialogData { readonly view: Signal<CopyReviewView>; }
export interface CopyMappingView {
  readonly source: string; readonly destination: string; readonly sourceState: string;
  readonly destinationState: string; readonly meals: number; readonly items: number; readonly clears: boolean;
  readonly content: readonly { readonly meal: string; readonly items: readonly string[] }[];
}
export interface CopyReviewView {
  readonly source: string; readonly destination: string; readonly rows: readonly CopyMappingView[];
  readonly ready: boolean; readonly loading: boolean; readonly pending: boolean; readonly error: string | null;
  readonly requiresReplacement: boolean; readonly confirmed: boolean;
}
