import { AssetsImageConfig } from './assets-image-config.js';
import { AssetsManifestIconConfig } from './assets-manifest-icon-config.js';

export interface AssetsImagesConfig {
  appleTouchIcon?: AssetsImageConfig;
  favicon: AssetsImageConfig;
  manifestIcons?: AssetsManifestIconConfig[];
}
