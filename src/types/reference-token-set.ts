import { Responsive } from './responsive.js';

export type ReferenceTokenSet = {
  name: string;
  path: string;
  responsive?: Responsive;
  selector?: string;
};
