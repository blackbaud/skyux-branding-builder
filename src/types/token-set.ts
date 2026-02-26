import { ReferenceTokenSet } from './reference-token-set.js';

export type TokenSet = {
  name: string;
  /**
   * 'public' token sets are output to the public API CSS bundle.
   * 'internal' (default) token sets are output to the standard bundles.
   */
  type?: 'public' | 'internal';
  path: string;
  /**
   * The path to the source/base token file used to resolve references.
   * Required for 'public' token sets so that referenced tokens resolve
   * correctly and receive proper naming (no `sky-` prefix for source tokens).
   */
  sourcePath?: string;
  selector: string;
  outputPath: string;
  referenceTokens: ReferenceTokenSet[];
};
