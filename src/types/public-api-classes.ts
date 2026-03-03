import { PublicApiClass } from './public-api-class.js';
import { PublicApiClassGroup } from './public-api-class-group.js';

export interface PublicApiClasses {
  groups?: PublicApiClassGroup[];
  classes?: PublicApiClass[];
}
