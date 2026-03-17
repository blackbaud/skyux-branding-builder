import { DemoMetadata } from './demo-metadata.js';

export interface PublicApiToken {
  name: string;
  customProperty?: string;
  description?: string;
  deprecatedCustomProperties?: string[];
  obsoleteCustomProperties?: string[];
  cssProperty?: string;
  demoMetadata?: DemoMetadata;
}
