import { Config, PlatformConfig } from 'style-dictionary';

export interface SkyStyleDictionaryConfig extends Config {
  platforms: {
    css: PlatformConfig;
    json?: PlatformConfig;
  };
}
