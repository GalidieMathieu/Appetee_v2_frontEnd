export interface User {
  readonly username: string;
  readonly imageUrl: string | null;
}

export interface UpdateCurrentUserRequest {
  readonly username: string;
  readonly imageUrl: string | null;
}

export type ExistsResponse = { readonly exists: boolean };
