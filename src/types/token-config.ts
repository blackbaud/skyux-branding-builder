import { TokenSet } from './token-set.js';

export type TokenConfig = {
  /**
   defaults to `src/tokens/`.
   */
  rootPath?: string;
  projectName: string;
  tokenSets: TokenSet[];
};
