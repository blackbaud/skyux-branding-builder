import { DemoMetadata } from './demo-metadata.js';

export interface PublicApiStyle {
  name: string;
  className?: string;
  selectors?: string[];
  properties?: Record<string, string>;
  /**
   * Context-aware custom properties (`--sky-ctx-override-*`) that this style sets for its
   * descendants. Emitted in CSS but never included in the public API JSON.
   */
  contextOverrides?: Record<string, string>;
  /**
   * Resets every context override declared in any style to `initial`, except the ones this
   * style sets itself, so a nested container does not inherit an ancestor's context.
   */
  resetContextOverrides?: boolean;
  description?: string;
  deprecatedClassNames?: string[];
  obsoleteClassNames?: string[];
  excludeFromDocs?: boolean;
  demoMetadata?: DemoMetadata;
}
