import { DemoMetadata } from './demo-metadata.js';

export interface PublicApiStyle {
  name: string;
  className?: string;
  selectors?: string[];
  /** A media query condition, e.g. `(prefers-reduced-motion: reduce)`. Wraps the style's rules in `@media`. */
  media?: string;
  properties?: Record<string, string>;
  contextOverrides?: Record<string, string>;
  /** Sets every other declared context override to `initial`. */
  resetContextOverrides?: boolean;
  description?: string;
  deprecatedClassNames?: string[];
  obsoleteClassNames?: string[];
  excludeFromDocs?: boolean;
  demoMetadata?: DemoMetadata;
}
