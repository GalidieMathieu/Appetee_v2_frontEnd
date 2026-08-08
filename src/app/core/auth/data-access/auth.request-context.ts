import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTO_LOGOUT = new HttpContextToken<boolean>(() => false);
