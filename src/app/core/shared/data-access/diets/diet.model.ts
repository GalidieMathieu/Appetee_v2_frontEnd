export interface Diet {
    id: number;
    name: string;
  }
  
export type CreateDietRequest = Pick<Diet, 'name'>;
export type UpdateDietRequest = Pick<Diet, 'name'>;