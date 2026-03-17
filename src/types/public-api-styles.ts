import { PublicApiStyle } from './public-api-style.js';
import { PublicApiStyleGroup } from './public-api-style-group.js';

export interface PublicApiStyles {
  groups?: PublicApiStyleGroup[];
  styles?: PublicApiStyle[];
}
