export interface PublicApiClass {
  name: string;
  className?: string;
  htmlElement?: string;
  properties?: Record<string, string>;
  description?: string;
  deprecatedClassName?: string;
}
