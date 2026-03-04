export interface PublicApiClass {
  name: string;
  className: string;
  properties: Record<string, string>;
  description?: string;
  deprecatedClassName?: string;
}
