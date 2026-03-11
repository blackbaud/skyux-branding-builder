export interface PublicApiStyle {
  name: string;
  className?: string;
  htmlElement?: string;
  properties?: Record<string, string>;
  description?: string;
  deprecatedClassNames?: string[];
}
