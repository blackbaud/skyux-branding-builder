import { PublicApiClass } from './public-api-class.js';

export interface PublicApiClassGroup {
  name: string;
  description?: string;
  groups?: PublicApiClassGroup[];
  classes?: PublicApiClass[];
  imageToken?: string;
}
