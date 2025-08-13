# SkyUX Brand Builder

A TypeScript package that provides type definitions for SkyUX design tokens and brand building.

## Installation

```bash
npm install skyux-brand-builder
```

## Usage

### Importing Types

```typescript
import type {
  Breakpoint,
  Responsive,
  ReferenceTokenSet,
  TokenConfig,
  TokenSet,
} from 'skyux-brand-builder';

// Example usage
const breakpoint: Breakpoint = 'l';

const tokenConfig: TokenConfig = {
  tokenSets: [
    {
      name: 'my-theme',
      path: './tokens',
      selector: '.my-theme',
      outputPath: './dist',
      referenceTokens: [],
    },
  ],
};
```

## Available Types

- **`Breakpoint`**: Defines responsive breakpoint values (`'xs' | 's' | 'm' | 'l'`)
- **`Responsive`**: Configuration for responsive behavior
- **`ReferenceTokenSet`**: Configuration for reference token sets
- **`TokenConfig`**: Main configuration object for token processing
- **`TokenSet`**: Individual token set configuration

## Development

To build the package:

```bash
npm run build
```

To run tests:

```bash
npm test
```

## License

MIT
# skyux-branding-builder
