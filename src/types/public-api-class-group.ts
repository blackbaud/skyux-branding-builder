import { PublicApiClass } from './public-api-class.js';

export interface PublicApiClassGroup {
  groupName: string;
  description?: string;
  groups?: PublicApiClassGroup[];
  classes?: PublicApiClass[];
}
