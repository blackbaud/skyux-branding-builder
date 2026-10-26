import { AssetsImageConfig } from './assets-image-config.js';

export interface AssetsManifestIconConfig extends AssetsImageConfig {
  sizes?: string;
  type?: string;
  purpose?: string;
}
