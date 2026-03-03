export interface PublicApiClass {
  name: string;
  cssClass: string;
  cssProperties: Record<string, string>;
  description?: string;
  deprecated?: string;
}
