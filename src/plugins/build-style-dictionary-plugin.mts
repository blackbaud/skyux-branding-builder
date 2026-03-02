import { sync } from 'glob';
import { Plugin } from 'vite';
import path from 'path';
import StyleDictionary, {
  Config,
  PlatformConfig,
  Token,
} from 'style-dictionary';
import { formattedVariables, sortByName } from 'style-dictionary/utils';
import { getTransforms, register } from '@tokens-studio/sd-transforms';
import { TokenConfig } from '../types/token-config.js';
import { TokenSet } from '../types/token-set.js';
import { Breakpoint } from '../types/breakpoint.js';
import { ReferenceTokenSet } from '../types/reference-token-set.js';
import {
  generateAssetsCss,
  fixAssetsUrlValue,
} from './shared/assets-utils.mjs';
import { PublicTokenSet } from '../types/public-token-set.js';
import { PublicApi } from '../types/public-api.js';
import { PublicApiGroup } from '../types/public-api-group.js';
import { PublicApiToken } from '../types/public-api-token.js';

interface SkyStyleDictionaryConfig extends Config {
  platforms: {
    css: PlatformConfig;
    json?: PlatformConfig;
  };
}

interface GeneratedFile {
  output: unknown;
  destination: string | undefined;
  breakpoint?: Breakpoint;
}

interface SkyTokenOptions {
  assetsBasePath: string;
  generateUrlAtProperties?: boolean;
  showDescriptions?: boolean;
  selectorPrefix: string;
}

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
    }
  },
};

function isUrlToken(token: Token): boolean {
  return (
    token.$extensions?.['com.blackbaud.developer.sky-token-format'] === 'url'
  );
}

function buildPublicApiGroups(
  allTokens: Token[],
  tokenTree: Record<string, unknown>,
): PublicApi {
  const result: PublicApi = {};

  for (const token of allTokens) {
    const groupPath: string[] = [];
    let current: Record<string, unknown> = tokenTree;

    for (const segment of token.path) {
      current = current[segment] as Record<string, unknown>;
      const extensions = current?.$extensions as
        | Record<string, unknown>
        | undefined;
      if (extensions?.groupName) {
        groupPath.push(extensions.groupName as string);
      }
    }

    const tokenEntry: PublicApiToken = {
      name: (token.$extensions?.name as string) ?? token.name,
      cssProperty: `--${token.name}`,
    };

    if (token.$description) {
      tokenEntry.description = token.$description;
    }

    if (token.$extensions?.deprecated) {
      tokenEntry.deprecated = token.$extensions.deprecated as string;
    }

    if (groupPath.length === 0) {
      result.tokens ??= [];
      result.tokens.push(tokenEntry);
    } else {
      result.groups ??= [];
      let currentGroups = result.groups;

      for (let i = 0; i < groupPath.length; i++) {
        const groupName = groupPath[i];
        let group = currentGroups.find((g) => g.groupName === groupName);
        if (!group) {
          group = { groupName };
          currentGroups.push(group);
        }
        if (i < groupPath.length - 1) {
          group.groups ??= [];
          currentGroups = group.groups;
        } else {
          group.tokens ??= [];
          group.tokens.push(tokenEntry);
        }
      }
    }
  }

  function cleanEmptyGroups(groups: PublicApiGroup[]): void {
    for (const group of groups) {
      if (group.groups) {
        if (group.groups.length === 0) {
          delete group.groups;
        } else {
          cleanEmptyGroups(group.groups);
        }
      }
    }
  }
  if (result.groups) {
    cleanEmptyGroups(result.groups);
  }

  return result;
}

function mergePublicApiGroupArrays(
  target: PublicApiGroup[],
  source: PublicApiGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.groupName === srcGroup.groupName);
    if (existing) {
      if (srcGroup.tokens) {
        existing.tokens ??= [];
        for (const token of srcGroup.tokens) {
          if (
            !existing.tokens.some((t) => t.cssProperty === token.cssProperty)
          ) {
            existing.tokens.push(token);
          }
        }
      }
      if (srcGroup.groups) {
        existing.groups ??= [];
        mergePublicApiGroupArrays(existing.groups, srcGroup.groups);
      }
    } else {
      target.push(srcGroup);
    }
  }
}

function mergePublicApiResults(
  target: PublicApi,
  source: PublicApi,
): void {
  if (source.tokens) {
    target.tokens ??= [];
    for (const token of source.tokens) {
      if (!target.tokens.some((t) => t.cssProperty === token.cssProperty)) {
        target.tokens.push(token);
      }
    }
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiGroupArrays(target.groups, source.groups);
  }
}

function getMediaQueryMinWidth(breakpoint: Breakpoint): string {
  switch (breakpoint) {
    case 'xs':
    default:
      return '0px';
    case 's':
      return '768px';
    case 'm':
      return '992px';
    case 'l':
      return '1200px';
  }
}

async function generateDictionaryFiles(
  tokenConfig: TokenConfig,
  skyOptions: SkyTokenOptions,
): Promise<{ tokenFiles: GeneratedFile[]; publicApiFiles: GeneratedFile[]; publicApiJsonFiles: GeneratedFile[] }> {
  const sd = new StyleDictionary(undefined);
  const rootPath = tokenConfig.rootPath || 'src/tokens/';

  const results = await Promise.all(
    tokenConfig.tokenSets.map(async (tokenSet) => {
      const setTokenFiles: GeneratedFile[] = [];
      const setPublicApiFiles: GeneratedFile[] = [];
      const setPublicApiJsonFiles: GeneratedFile[] = [];

      const tokenDictionary = await sd.extend(
        getBaseDictionaryConfig(rootPath, tokenSet, {
          ...skyOptions,
          generateUrlAtProperties: true,
        }),
      );

      const baseFiles: GeneratedFile[] = await tokenDictionary.formatPlatform('css');
      setTokenFiles.push(...baseFiles);

      const refResults = await Promise.all(
        tokenSet.referenceTokens.map(async (referenceTokenSet) => {
          const referenceTokenDictionary = await sd.extend(
            getReferenceDictionaryConfig(
              rootPath,
              tokenSet,
              referenceTokenSet,
              skyOptions,
            ),
          );
          const files: GeneratedFile[] = await referenceTokenDictionary.formatPlatform('css');
          files.forEach((file) => {
            if (referenceTokenSet.responsive) {
              const originalOutput = file.output as string;

              // NOTE: No return character after original output as we have already added one there when we alphabetize
              file.output =
                referenceTokenSet.responsive.breakpoint === 'xs'
                  ? originalOutput
                  : `@media (min-width: ${getMediaQueryMinWidth(referenceTokenSet.responsive.breakpoint)}) {\n${originalOutput}}\n`;
              file.breakpoint = referenceTokenSet.responsive.breakpoint;
            }
          });
          return files;
        }),
      );
      setTokenFiles.push(...refResults.flat());

      if (tokenSet.publicTokens?.length) {
        const publicResults = await Promise.all(
          tokenSet.publicTokens.map(async (publicTokenSet) => {
            const publicTokenDictionary = await sd.extend(
              getPublicDictionaryConfig(
                rootPath,
                tokenSet,
                publicTokenSet,
                skyOptions,
              ),
            );
            const cssFiles = await publicTokenDictionary.formatPlatform('css') as GeneratedFile[];
            const jsonFiles = await publicTokenDictionary.formatPlatform('json') as GeneratedFile[];
            return { cssFiles, jsonFiles };
          }),
        );
        setPublicApiFiles.push(...publicResults.flatMap((r) => r.cssFiles));
        setPublicApiJsonFiles.push(...publicResults.flatMap((r) => r.jsonFiles));
      }

      return { setTokenFiles, setPublicApiFiles, setPublicApiJsonFiles };
    }),
  );

  const tokenFiles = results.flatMap((r) => r.setTokenFiles);
  const publicApiFiles = results.flatMap((r) => r.setPublicApiFiles);
  const publicApiJsonFiles = results.flatMap((r) => r.setPublicApiJsonFiles);

  // We need to order the files by breakpoint so that the media queries are seen by the browser in the correct order.
  // Media queries do not count towards css specificity, so the order in which they are defined matters.
  const breakpointOrder = [undefined, 'xs', 's', 'm', 'l'];
  tokenFiles.sort((a, b) => {
    const aIndex = breakpointOrder.indexOf(a.breakpoint);
    const bIndex = breakpointOrder.indexOf(b.breakpoint);
    return aIndex - bIndex;
  });

  return { tokenFiles, publicApiFiles, publicApiJsonFiles };
}

function getBaseDictionaryConfig(
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

function getReferenceDictionaryConfig(
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

function getPublicDictionaryConfig(
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
      filter: (token) => token.filePath.includes(publicTokenSet.path),
    },
  ];

  config.platforms.json = {
    transformGroup: 'custom/tokens-studio',
    buildPath: 'dist/',
    files: [
      {
        destination: `${tokenSet.name}/${publicTokenSet.name}.json`,
        format: 'json/public-api',
        filter: (token) => token.filePath.includes(publicTokenSet.path),
      },
    ],
  };

  return config;
}

async function addAssetsCss(
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

export function buildStyleDictionaryPlugin(tokenConfig: TokenConfig): Plugin {
  register(StyleDictionary);

  StyleDictionary.registerTransform({
    name: 'name/prefixed-kebab',
    transitive: true,
    type: 'name',
    transform: (token) => {
      return `${token.isSource ? '' : 'sky-'}${token.path.join('-')}`;
    },
  });

  StyleDictionary.registerTransform({
    name: 'size/zero-rem',
    type: 'value',
    filter: (token) =>
      (token.$type === 'dimension' || token.$type === 'fontSize') &&
      token.$value === '0',
    transform: () => '0rem',
  });

  StyleDictionary.registerTransform({
    name: 'assets-path',
    type: 'value',
    filter: isUrlToken,
    transform: (token, platformConfig) =>
      fixAssetsUrlValue(
        platformConfig.options?.skyOptions?.assetsBasePath,
        token.$value,
        tokenConfig.projectName,
      ),
  });

  // Register custom tokens-studio transform group without the resolveMath transform to allow browsers to do the `calc`.
  // Include the standard css transforms and the custom name transform.
  StyleDictionary.registerTransformGroup({
    name: 'custom/tokens-studio',
    transforms: [
      ...getTransforms({
        platform: 'css',
      }).filter((transform) => transform !== 'ts/resolveMath'),
      ...StyleDictionary.hooks.transformGroups['css'],
      'name/prefixed-kebab',
      'size/zero-rem',
      'assets-path',
    ],
  });

  StyleDictionary.registerFormat({
    name: 'css/alphabetize-variables',
    format: function ({ dictionary, options }) {
      const { outputReferences, outputReferenceFallbacks, skyOptions } =
        options;

      let properties = '';

      if (skyOptions.generateUrlAtProperties) {
        properties = dictionary.allTokens
          .filter(isUrlToken)
          .sort(sortByName)
          .map(
            (token) => `@property --${token.name} {
  syntax: '<url>';
  inherits: true;
  initial-value: url('data:,');
}`,
          )
          .join('\n\n');
      }

      dictionary.allTokens = dictionary.allTokens.sort(sortByName);

      const variables = formattedVariables({
        format: 'css',
        dictionary,
        outputReferences,
        outputReferenceFallbacks,
        usesDtcg: true,
        ...(skyOptions.showDescriptions
          ? {
              formatting: {
                commentStyle: 'long',
                commentPosition: 'above',
              },
            }
          : {}),
      });

      return `${properties ? properties + '\n\n' : ''}${skyOptions?.selectorPrefix ?? ''}${options.selector} {
${variables}
}
`;
    },
  });

  StyleDictionary.registerFormat({
    name: 'json/public-api',
    format: function ({ dictionary }) {
      const tokenTree = (
        dictionary.unfilteredTokens ?? dictionary.tokens
      ) as unknown as Record<string, unknown>;
      const result = buildPublicApiGroups(dictionary.allTokens, tokenTree);
      return JSON.stringify(result, null, 2);
    },
  });

  return {
    name: 'transform-style-dictionary',
    async transform(_code: string, id: string): Promise<string | undefined> {
      const rootPath = tokenConfig.rootPath || 'src/tokens/';
      const files = sync(`${rootPath}**/*.json`);
      for (const file of files) {
        this.addWatchFile(path.join(process.cwd(), file));
      }

      if (id.includes('src/dev/tokens.css')) {
        const assetsBasePath = '/assets/';

        const { tokenFiles, publicApiFiles } = await generateDictionaryFiles(
          tokenConfig,
          {
            assetsBasePath,
            selectorPrefix: '.local-dev-tokens',
          },
        );
        const allFiles = tokenFiles.concat(publicApiFiles);

        let localTokens = allFiles.reduce((acc, file) => acc + file.output, '');

        localTokens = await addAssetsCss(
          tokenConfig,
          assetsBasePath,
          localTokens,
        );

        return localTokens;
      }

      return undefined;
    },
    async generateBundle(): Promise<void> {
      const assetsBasePath = '../';

      const { tokenFiles, publicApiFiles, publicApiJsonFiles } =
        await generateDictionaryFiles(tokenConfig, {
          assetsBasePath,
          selectorPrefix: '',
        });

      const compositeFiles: Record<string, string> = {};
      const publicApiFileName = 'bundles/public-api.css';

      for (const file of tokenFiles) {
        if (file.destination) {
          const fileParts = file.destination.split('/');
          const tokenSetType = fileParts[1];
          const fileName = `bundles/${tokenSetType}.css`;
          // For backwards compatibility with older versions of SKY UX; remove this in a future
          // breaking change.
          const compatFileName = `assets/scss/${tokenSetType}.css`;

          let fileContents = compositeFiles[fileName] || '';
          fileContents = fileContents.concat((file.output as string) ?? '');

          compositeFiles[fileName] = fileContents;
          compositeFiles[compatFileName] = fileContents;
        }
      }

      for (const file of publicApiFiles) {
        let fileContents = compositeFiles[publicApiFileName] || '';
        fileContents = fileContents.concat((file.output as string) ?? '');

        compositeFiles[publicApiFileName] = fileContents;
      }

      for (const fileName of Object.keys(compositeFiles)) {
        const fileContents = await addAssetsCss(
          tokenConfig,
          assetsBasePath,
          compositeFiles[fileName],
        );

        this.emitFile({
          type: 'asset',
          fileName: fileName.replace('dist/', ''),
          source: fileContents,
        });
      }

      const publicApiJsonData: PublicApi = {};
      for (const file of publicApiJsonFiles) {
        const parsed = JSON.parse(file.output as string) as PublicApi;
        mergePublicApiResults(publicApiJsonData, parsed);
      }
      if (publicApiJsonData.groups || publicApiJsonData.tokens) {
        this.emitFile({
          type: 'asset',
          fileName: 'bundles/public-api.json',
          source: JSON.stringify(publicApiJsonData, null, 2),
        });
      }
    },
  };
}
