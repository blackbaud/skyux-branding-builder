export interface PublicApiClass {
  name: string;
  cssClass: string;
  description?: string;
  deprecated?: string;
  cssProperties?: Record<string, string>;
}
