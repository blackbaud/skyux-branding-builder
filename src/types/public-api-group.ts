import { PublicApiToken } from './public-api-token.js';

export interface PublicApiGroup {
  groupName: string;
  groups?: PublicApiGroup[];
  tokens?: PublicApiToken[];
}
