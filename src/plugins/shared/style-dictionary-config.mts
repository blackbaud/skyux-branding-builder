import path from 'path';
import { Token } from 'style-dictionary';

import { Breakpoint } from '../../types/breakpoint.js';
import { PublicTokenSet } from '../../types/public-token-set.js';
import { ReferenceTokenSet } from '../../types/reference-token-set.js';
import { SkyStyleDictionaryConfig } from '../../types/sky-style-dictionary-config.js';
import { SkyTokenOptions } from '../../types/sky-token-options.js';
import { TokenConfig } from '../../types/token-config.js';
import { TokenSet } from '../../types/token-set.js';
import { generateAssetsCss } from './assets-utils.mjs';

const DEFAULT_SD_CONFIG: SkyStyleDictionaryConfig = {
  preprocessors: ['tokens-studio'],
  platforms: {
    css: {
      transformGroup: 'custom/tokens-studio',
      options: {
        outputReferences: true,
        showFileHeader: false,
      },
      buildPath: `dist/`,
    },
  },
};

export function isUrlToken(token: Token): boolean {
  return (
    (token.$extensions as Record<string, unknown>)?.[
      'com.blackbaud.developer.sky-token-format'
    ] === 'url'
  );
}

export function getMediaQueryMinWidth(breakpoint: Breakpoint): string {
  switch (breakpoint) {
    case 'xs':
      return '0px';
    case 's':
      return '768px';
    case 'm':
      return '992px';
    case 'l':
      return '1200px';
    default:
      return '0px';
  }
}

export function getBaseDictionaryConfig(
  rootPath: string,
  tokenSet: TokenSet,
  skyOptions: SkyTokenOptions,
): SkyStyleDictionaryConfig {
  const config = structuredClone(DEFAULT_SD_CONFIG);

  config.source = [`${rootPath}${tokenSet.path}`];

  const cssOptions = (config.platforms.css.options ??= {});

  Object.assign(cssOptions, {
    skyOptions,
    selector: tokenSet.selector,
  });

  config.platforms.css.files = [
    {
      destination: `${tokenSet.name}/${tokenSet.name}.css`,
      format: 'css/alphabetize-variables',
      filter: (token) => token.isSource,
    },
  ];

  return config;
}

export function getReferenceDictionaryConfig(
  rootPath: string,
  tokenSet: TokenSet,
  referenceTokenSet: ReferenceTokenSet,
  skyOptions: SkyTokenOptions,
): SkyStyleDictionaryConfig {
  const config = structuredClone(DEFAULT_SD_CONFIG);
  config.source = [`${rootPath}${tokenSet.path}`];
  config.include = [`${rootPath}${referenceTokenSet.path}`];

  const cssOptions = (config.platforms.css.options ??= {});

  Object.assign(cssOptions, {
    skyOptions,
    selector: `${tokenSet.selector}${referenceTokenSet.selector || ''}`,
  });

  config.platforms.css.files = [
    {
      destination: `${tokenSet.name}/${referenceTokenSet.name}.css`,
      format: 'css/alphabetize-variables',
      filter: (token) => !token.isSource,
    },
  ];

  return config;
}

export function getPublicDictionaryConfig(
  rootPath: string,
  tokenSet: TokenSet,
  publicTokenSet: PublicTokenSet,
  skyOptions: SkyTokenOptions,
): SkyStyleDictionaryConfig {
  const config = structuredClone(DEFAULT_SD_CONFIG);
  config.source = [`${rootPath}${tokenSet.path}`];
  config.include = [
    `${rootPath}${publicTokenSet.path}`,
    ...tokenSet.referenceTokens.map(
      (referenceTokenSet) => `${rootPath}${referenceTokenSet.path}`,
    ),
  ];

  const cssOptions = (config.platforms.css.options ??= {});

  Object.assign(cssOptions, {
    skyOptions: { ...skyOptions, showDescriptions: true },
    selector: tokenSet.selector,
  });

  config.platforms.css.files = [
    {
      destination: `${tokenSet.name}/${publicTokenSet.name}.css`,
      format: 'css/alphabetize-variables',
      filter: (token) =>
        path.normalize(token.filePath) ===
        path.normalize(`${rootPath}${publicTokenSet.path}`),
    },
  ];

  return config;
}

export async function addAssetsCss(
  tokenConfig: TokenConfig,
  basePath: string,
  fileContents: string,
): Promise<string> {
  const assetsCss = await generateAssetsCss(basePath, tokenConfig.projectName);

  if (assetsCss) {
    fileContents = `${assetsCss}\n\n${fileContents}`;
  }

  return fileContents;
}
