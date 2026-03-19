import { DemoMetadata } from './demo-metadata.js';
import { PublicApiStyle } from './public-api-style.js';

export interface PublicApiStyleGroup {
  name: string;
  description?: string;
  demoMetadata?: DemoMetadata;
  groups?: PublicApiStyleGroup[];
  styles?: PublicApiStyle[];
  imageToken?: string;
}
