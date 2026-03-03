export type UserSession = {
  userId: number;
  username: string;
};

export type LoginRequest = { 
  email: string;
  password: string;
};

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
  dietIds?: readonly number[] | null;
  ingredientRestrictionIds?: readonly number[] | null;
}