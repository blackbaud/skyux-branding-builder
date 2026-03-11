export interface PublicApiToken {
  name: string;
  customProperty?: string;
  description?: string;
  deprecatedCustomProperties?: string[];
  obsoleteCustomProperties?: string[];
  intendedCssProperty?: string;
}
