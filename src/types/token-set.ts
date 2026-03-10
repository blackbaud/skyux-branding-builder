import { PublicClassSet } from './public-class-set.js';
import { PublicTokenSet } from './public-token-set.js';
import { ReferenceTokenSet } from './reference-token-set.js';

export type TokenSet = {
  name: string;
  path: string;
  selector: string;
  outputPath: string;
  referenceTokens: ReferenceTokenSet[];
  publicTokens?: PublicTokenSet[];
  publicClasses?: PublicClassSet[];
};

