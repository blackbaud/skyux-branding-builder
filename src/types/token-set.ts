import { ReferenceTokenSet } from './reference-token-set.js';

export type TokenSet = {
  name: string;
  path: string;
  selector: string;
  outputPath: string;
  referenceTokens: ReferenceTokenSet[];
};
