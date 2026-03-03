import { Breakpoint } from './breakpoint.js';

export interface GeneratedFile {
  output: unknown;
  destination: string | undefined;
  breakpoint?: Breakpoint;
}
