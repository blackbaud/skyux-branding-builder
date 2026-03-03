import { PublicApiGroup } from './public-api-group.js';
import { PublicApiToken } from './public-api-token.js';

export interface PublicApiTokens {
  groups?: PublicApiGroup[];
  tokens?: PublicApiToken[];
}
