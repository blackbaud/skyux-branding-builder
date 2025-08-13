import { AssetsFontConfig } from './assets-font-config.js';
import { AssetsImagesConfig } from './assets-images-config.js';
import { AssetsStringsConfig } from './assets-strings-config.js';

export interface AssetsConfig {
  fonts?: AssetsFontConfig[];
  images?: AssetsImagesConfig;
  strings?: AssetsStringsConfig;
}
