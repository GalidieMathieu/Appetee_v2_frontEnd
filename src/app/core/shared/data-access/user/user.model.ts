export interface User {
    id: number;
    username: string;
    email: string;
    dietIds?: readonly number[] | null;
    ingredientRestrictionIds?: readonly number[] | null;
  }

  export interface changePasswordRequest{
    password : string;
  }

  export type ExistsResponse = { exists: boolean };
