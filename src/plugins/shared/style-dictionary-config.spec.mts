import { describe, expect, it } from 'vitest';
import type { Token } from 'style-dictionary';

import type { Breakpoint } from '../../types/breakpoint.js';

import {
  getBaseDictionaryConfig,
  getMediaQueryMinWidth,
  getPublicDictionaryConfig,
  getReferenceDictionaryConfig,
  isUrlToken,
} from './style-dictionary-config.mjs';

describe('isUrlToken', () => {
  it('should return true for tokens with sky-token-format url extension', () => {
    const token = {
      $extensions: {
        'com.blackbaud.developer.sky-token-format': 'url',
      },
    } as unknown as Token;

    expect(isUrlToken(token)).toBe(true);
  });

  it('should return false for tokens without the extension', () => {
    const token = {} as unknown as Token;
    expect(isUrlToken(token)).toBe(false);
  });

  it('should return false for tokens with a different extension value', () => {
    const token = {
      $extensions: {
        'com.blackbaud.developer.sky-token-format': 'other',
      },
    } as unknown as Token;

    expect(isUrlToken(token)).toBe(false);
  });

  it('should return false when $extensions exists but has no sky-token-format', () => {
    const token = {
      $extensions: { something: 'else' },
    } as unknown as Token;

    expect(isUrlToken(token)).toBe(false);
  });
});

describe('getMediaQueryMinWidth', () => {
  it.each<[Breakpoint, string]>([
    ['xs', '0px'],
    ['s', '768px'],
    ['m', '992px'],
    ['l', '1200px'],
  ])('should return %s for breakpoint "%s"', (breakpoint, expected) => {
    expect(getMediaQueryMinWidth(breakpoint)).toBe(expected);
  });
});

describe('getBaseDictionaryConfig', () => {
  const skyOptions = {
    assetsBasePath: '/assets/',
    selectorPrefix: '',
  };

  const tokenSet = {
    name: 'rainbow',
    path: 'base-rainbow.json',
    selector: '.sky-theme-rainbow',
    outputPath: 'dist/',
    referenceTokens: [],
  };

  it('should set source to the tokenSet path prefixed by rootPath', () => {
    const config = getBaseDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      skyOptions,
    );
    expect(config.source).toEqual(['src/fixtures/base-rainbow.json']);
  });

  it('should set the CSS selector from the tokenSet', () => {
    const config = getBaseDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      skyOptions,
    );
    expect(config.platforms.css.options?.selector).toBe('.sky-theme-rainbow');
  });

  it('should configure a single CSS file output', () => {
    const config = getBaseDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      skyOptions,
    );
    expect(config.platforms.css.files).toHaveLength(1);
    expect(config.platforms.css.files![0].destination).toBe(
      'rainbow/rainbow.css',
    );
  });

  it('should not mutate the config between calls', () => {
    const config1 = getBaseDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      skyOptions,
    );
    const config2 = getBaseDictionaryConfig('other/', tokenSet, skyOptions);
    expect(config1.source).not.toEqual(config2.source);
  });
});

describe('getReferenceDictionaryConfig', () => {
  const skyOptions = {
    assetsBasePath: '/assets/',
    selectorPrefix: '',
  };

  const tokenSet = {
    name: 'rainbow',
    path: 'base-rainbow.json',
    selector: '.sky-theme-rainbow',
    outputPath: 'dist/',
    referenceTokens: [],
  };

  const refTokenSet = {
    name: 'muted-colors',
    path: 'muted-colors.json',
    selector: '.sky-theme-muted',
  };

  it('should set include to the reference token set path', () => {
    const config = getReferenceDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      refTokenSet,
      skyOptions,
    );
    expect(config.include).toEqual(['src/fixtures/muted-colors.json']);
  });

  it('should combine selectors', () => {
    const config = getReferenceDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      refTokenSet,
      skyOptions,
    );
    expect(config.platforms.css.options?.selector).toBe(
      '.sky-theme-rainbow.sky-theme-muted',
    );
  });

  it('should handle an empty reference selector', () => {
    const config = getReferenceDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      { ...refTokenSet, selector: '' },
      skyOptions,
    );
    expect(config.platforms.css.options?.selector).toBe('.sky-theme-rainbow');
  });
});

describe('getPublicDictionaryConfig', () => {
  const skyOptions = {
    assetsBasePath: '/assets/',
    selectorPrefix: '',
  };

  const tokenSet = {
    name: 'rainbow',
    path: 'base-rainbow.json',
    selector: '.sky-theme-rainbow',
    outputPath: 'dist/',
    referenceTokens: [{ name: 'muted-colors', path: 'muted-colors.json' }],
  };

  const publicTokenSet = {
    name: 'public-colors',
    path: 'public-colors.json',
  };

  it('should include the public token path and all reference token paths', () => {
    const config = getPublicDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      publicTokenSet,
      skyOptions,
    );
    expect(config.include).toEqual([
      'src/fixtures/public-colors.json',
      'src/fixtures/muted-colors.json',
    ]);
  });

  it('should enable showDescriptions in skyOptions', () => {
    const config = getPublicDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      publicTokenSet,
      skyOptions,
    );
    expect(config.platforms.css.options?.skyOptions.showDescriptions).toBe(
      true,
    );
  });

  it('should configure CSS platform output only', () => {
    const config = getPublicDictionaryConfig(
      'src/fixtures/',
      tokenSet,
      publicTokenSet,
      skyOptions,
    );
    expect(config.platforms.css.files).toHaveLength(1);
    expect(config.platforms.css.files![0].destination).toBe(
      'rainbow/public-colors.css',
    );
  });
});
