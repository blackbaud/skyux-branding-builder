export interface DemoMetadata {
  type?:
    | 'border'
    | 'border-color'
    | 'border-radius'
    | 'border-style'
    | 'border-width'
    | 'color-swatch'
    | 'elevation'
    | 'icon-background-color'
    | 'icon-color'
    | 'none'
    | 'text'
    | 'text-color';
  /** Describes how the demo is rendered, independently of what it demonstrates, if different from standard. */
  renderAs?: 'element' | 'multi-prop';
  background?: string;
  color?: string;
  text?: string;
  height?: string;
  width?: string;
}
