import { readFile } from 'fs/promises';
import { sync } from 'glob';
import { Plugin } from 'vite';
import path from 'path';
import StyleDictionary from 'style-dictionary';
import { formattedVariables, sortByName } from 'style-dictionary/utils';
import { getTransforms, register } from '@tokens-studio/sd-transforms';
import { TokenConfig } from '../types/token-config.js';
import { PublicApiTokens } from '../types/public-api-tokens.js';
import { PublicApiStyles } from '../types/public-api-styles.js';
import { GeneratedFile } from '../types/generated-file.js';
import { SkyTokenOptions } from '../types/sky-token-options.js';
import { fixAssetsUrlValue } from './shared/assets-utils.mjs';
import {
  applyTokenDemoMetadataInheritance,
  collectPublicTokenCustomProperties,
  mergePublicApiResults,
  validatePublicApiTokensDocs,
} from './shared/public-api-tokens-utils.mjs';
import {
  applyStylesDemoMetadataInheritance,
  generatePublicStylesCss,
  mergePublicApiStylesResults,
  mergePublicApiStylesResultsForCss,
  validatePublicStylesCssProperties,
} from './shared/public-api-styles-utils.mjs';
import {
  addAssetsCss,
  getBaseDictionaryConfig,
  getMediaQueryMinWidth,
  getPublicDictionaryConfig,
  getReferenceDictionaryConfig,
  isUrlToken,
} from './shared/style-dictionary-config.mjs';

function extractCustomPropertiesFromCss(
  cssFiles: GeneratedFile[],
): Set<string> {
  const regex = /^\s+--([\w-]+)\s*:/gm;
  return new Set(
    cssFiles.flatMap((file) =>
      [...(file.output as string).matchAll(regex)].map((m) => `--${m[1]}`),
    ),
  );
}

async function generateDictionaryFiles(
  tokenConfig: TokenConfig,
  skyOptions: SkyTokenOptions,
): Promise<{
  tokenFiles: GeneratedFile[];
  publicTokenCssFiles: GeneratedFile[];
  publicTokenJsonFiles: string[];
  publicClassJsonFiles: string[];
}> {
  const sd = new StyleDictionary({ log: { verbosity: 'verbose' } });
  const rootPath = tokenConfig.rootPath || 'src/tokens/';

  const results = await Promise.all(
    tokenConfig.tokenSets.map(async (tokenSet) => {
      const tokenFiles: GeneratedFile[] = [];
      const publicTokenCssFiles: GeneratedFile[] = [];
      const publicTokenJsonFiles: string[] = [];
      const publicClassJsonFiles: string[] = [];

      const tokenDictionary = await sd.extend(
        getBaseDictionaryConfig(rootPath, tokenSet, {
          ...skyOptions,
          generateUrlAtProperties: true,
        }),
      );

      const sourceCssFiles: GeneratedFile[] =
        await tokenDictionary.formatPlatform('css');
      tokenFiles.push(...sourceCssFiles);

      const referenceTokenResults = await Promise.all(
        tokenSet.referenceTokens.map(async (referenceTokenSet) => {
          const referenceTokenDictionary = await sd.extend(
            getReferenceDictionaryConfig(
              rootPath,
              tokenSet,
              referenceTokenSet,
              skyOptions,
            ),
          );
          const files: GeneratedFile[] =
            await referenceTokenDictionary.formatPlatform('css');
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
      tokenFiles.push(...referenceTokenResults.flat());

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
            const cssFiles = (await publicTokenDictionary.formatPlatform(
              'css',
            )) as GeneratedFile[];

            const docsJson = await readFile(
              path.join(process.cwd(), `${rootPath}${publicTokenSet.docsPath}`),
              'utf-8',
            );
            const docsData = JSON.parse(docsJson) as PublicApiTokens;

            const generatedCustomProperties =
              extractCustomPropertiesFromCss(cssFiles);

            const docsCustomProperties =
              collectPublicTokenCustomProperties(docsData);
            validatePublicApiTokensDocs(
              docsCustomProperties,
              generatedCustomProperties,
              publicTokenSet.name,
            );

            return {
              cssFiles,
              docsData,
            };
          }),
        );
        publicTokenCssFiles.push(...publicResults.flatMap((r) => r.cssFiles));
        publicTokenJsonFiles.push(
          ...publicResults.map((r) => JSON.stringify(r.docsData)),
        );
      }

      if (tokenSet.publicStyles?.length) {
        // Build the set of known CSS custom properties from this token set's public tokens.
        const knownCustomProperties = new Set<string>();
        for (const json of publicTokenJsonFiles) {
          const parsed = JSON.parse(json) as PublicApiTokens;
          collectPublicTokenCustomProperties(parsed, knownCustomProperties);
        }

        const classResults = await Promise.all(
          tokenSet.publicStyles.map(async (publicStyleSet) => {
            const json = await readFile(
              path.join(process.cwd(), `${rootPath}${publicStyleSet.path}`),
              'utf-8',
            );
            const publicApiStyles = JSON.parse(json) as PublicApiStyles;
            validatePublicStylesCssProperties(
              publicApiStyles,
              knownCustomProperties,
              publicStyleSet.name,
            );
            return JSON.stringify(publicApiStyles);
          }),
        );
        publicClassJsonFiles.push(...classResults);
      }

      return {
        setTokenFiles: tokenFiles,
        setPublicTokenCssFiles: publicTokenCssFiles,
        setPublicTokenJsonFiles: publicTokenJsonFiles,
        setPublicClassJsonFiles: publicClassJsonFiles,
      };
    }),
  );

  const tokenFiles = results.flatMap((r) => r.setTokenFiles);
  const publicTokenCssFiles = results.flatMap((r) => r.setPublicTokenCssFiles);
  const publicTokenJsonFiles = results.flatMap(
    (r) => r.setPublicTokenJsonFiles,
  );
  const publicClassJsonFiles = results.flatMap(
    (r) => r.setPublicClassJsonFiles,
  );

  // We need to order the files by breakpoint so that the media queries are seen by the browser in the correct order.
  // Media queries do not count towards css specificity, so the order in which they are defined matters.
  const breakpointOrder = [undefined, 'xs', 's', 'm', 'l'];
  tokenFiles.sort((a, b) => {
    const aIndex = breakpointOrder.indexOf(a.breakpoint);
    const bIndex = breakpointOrder.indexOf(b.breakpoint);
    return aIndex - bIndex;
  });

  return {
    tokenFiles,
    publicTokenCssFiles,
    publicTokenJsonFiles,
    publicClassJsonFiles,
  };
}

export function buildStyleDictionaryPlugin(tokenConfig: TokenConfig): Plugin {
  void register(StyleDictionary);

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
        (platformConfig.options as { skyOptions?: SkyTokenOptions } | undefined)
          ?.skyOptions?.assetsBasePath,
        token.$value as string,
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
      ...StyleDictionary.hooks.transformGroups.css,
      'name/prefixed-kebab',
      'size/zero-rem',
      'assets-path',
    ],
  });

  StyleDictionary.registerFormat({
    name: 'css/alphabetize-variables',
    format: function ({ dictionary, options }) {
      const {
        outputReferences,
        outputReferenceFallbacks,
        skyOptions,
        selector,
      } = options as {
        outputReferences?: boolean;
        outputReferenceFallbacks?: boolean;
        skyOptions: SkyTokenOptions;
        selector: string;
      };

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

      return `${properties ? properties + '\n\n' : ''}${skyOptions?.selectorPrefix ?? ''}${selector} {
${variables}
}
`;
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

        const { tokenFiles, publicTokenCssFiles, publicClassJsonFiles } =
          await generateDictionaryFiles(tokenConfig, {
            assetsBasePath,
            selectorPrefix: '.local-dev-tokens',
          });
        const allFiles = tokenFiles.concat(publicTokenCssFiles);

        let localTokens = allFiles.reduce(
          (acc, file) => acc + (file.output as string),
          '',
        );

        const publicApiStylesJsonData: PublicApiStyles = {};
        const publicApiStylesCssData: PublicApiStyles = {};
        for (const json of publicClassJsonFiles) {
          const parsed = JSON.parse(json) as PublicApiStyles;
          mergePublicApiStylesResults(publicApiStylesJsonData, parsed);
          mergePublicApiStylesResultsForCss(publicApiStylesCssData, parsed);
        }
        if (publicApiStylesCssData.groups || publicApiStylesCssData.styles) {
          localTokens += generatePublicStylesCss(publicApiStylesCssData);
        }

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

      const {
        tokenFiles,
        publicTokenCssFiles,
        publicTokenJsonFiles,
        publicClassJsonFiles,
      } = await generateDictionaryFiles(tokenConfig, {
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

          const output = (file.output as string) ?? '';
          compositeFiles[fileName] = (compositeFiles[fileName] ?? '') + output;
          compositeFiles[compatFileName] =
            (compositeFiles[compatFileName] ?? '') + output;
        }
      }

      for (const file of publicTokenCssFiles) {
        compositeFiles[publicApiFileName] =
          (compositeFiles[publicApiFileName] ?? '') +
          ((file.output as string) ?? '');
      }

      const publicApiStylesJsonData: PublicApiStyles = {};
      const publicApiStylesCssData: PublicApiStyles = {};
      for (const json of publicClassJsonFiles) {
        const parsed = JSON.parse(json) as PublicApiStyles;
        mergePublicApiStylesResults(publicApiStylesJsonData, parsed);
        mergePublicApiStylesResultsForCss(publicApiStylesCssData, parsed);
      }
      applyStylesDemoMetadataInheritance(publicApiStylesJsonData);
      if (publicApiStylesCssData.groups || publicApiStylesCssData.styles) {
        compositeFiles[publicApiFileName] =
          (compositeFiles[publicApiFileName] ?? '') +
          generatePublicStylesCss(publicApiStylesCssData);
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

      const publicApiJsonData: PublicApiTokens = {};
      for (const json of publicTokenJsonFiles) {
        const parsed = JSON.parse(json) as PublicApiTokens;
        mergePublicApiResults(publicApiJsonData, parsed);
      }
      applyTokenDemoMetadataInheritance(publicApiJsonData);
      if (publicApiJsonData.groups || publicApiJsonData.tokens) {
        this.emitFile({
          type: 'asset',
          fileName: 'bundles/public-api-tokens.json',
          source: JSON.stringify(publicApiJsonData, null, 2),
        });
      }

      if (publicApiStylesJsonData.groups || publicApiStylesJsonData.styles) {
        this.emitFile({
          type: 'asset',
          fileName: 'bundles/public-api-styles.json',
          source: JSON.stringify(publicApiStylesJsonData, null, 2),
        });
      }
    },
  };
}
