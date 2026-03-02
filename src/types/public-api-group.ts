import { PublicApiToken } from './public-api-token.js';

export interface PublicApiGroup {
  groupName: string;
  description?: string;
  groups?: PublicApiGroup[];
  tokens?: PublicApiToken[];
}
