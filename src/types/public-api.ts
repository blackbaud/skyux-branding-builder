import { PublicApiGroup } from './public-api-group.js';
import { PublicApiToken } from './public-api-token.js';

export interface PublicApi {
  groups?: PublicApiGroup[];
  tokens?: PublicApiToken[];
}
