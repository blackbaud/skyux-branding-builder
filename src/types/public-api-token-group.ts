import { DemoMetadata } from './demo-metadata.js';
import { PublicApiToken } from './public-api-token.js';

export interface PublicApiTokenGroup {
  groupName: string;
  description?: string;
  demoMetadata?: DemoMetadata;
  groups?: PublicApiTokenGroup[];
  tokens?: PublicApiToken[];
}
