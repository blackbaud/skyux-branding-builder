import { describe, expect, it, Mock, vi } from 'vitest';
import type { EmittedAsset } from 'rollup';
import { buildStyleDictionaryPlugin } from './build-style-dictionary-plugin.mjs';
import * as assetsUtils from './shared/assets-utils.mjs';
import { TokenConfig } from '../types/token-config.js';

vi.stubEnv('PACKAGEJSON_VERSION', undefined);

describe('buildStyleDictionaryPlugin', () => {
  async function callGenerateBundle(
    plugin: ReturnType<typeof buildStyleDictionaryPlugin>,
    emitFileSpy: Mock,
  ): Promise<void> {
    if (plugin.generateBundle) {
      await (
        plugin.generateBundle as (this: {
          emitFile: (emittedFile: EmittedAsset) => string;
        }) => void | Promise<void>
      ).call({
        emitFile: emitFileSpy,
      });
    }
  }

  async function validate(
    tokenConfig: TokenConfig,
    expectedEmittedFiles: { fileName: string; source: string }[],
    assetsCssMock: (basePath?: string) => Promise<string> = () =>
      Promise.resolve(''),
    expectedEmittedPublicApiFile?: { source: string },
    expectedEmittedPublicApiJsonFile?: { source: string },
    expectedEmittedPublicApiStylesJsonFile?: { source: string },
  ): Promise<void> {
    vi.spyOn(assetsUtils, 'generateAssetsCss').mockImplementation(
      assetsCssMock,
    );
    const plugin = buildStyleDictionaryPlugin(tokenConfig);
    const emitFileSpy = vi.fn();
    await callGenerateBundle(plugin, emitFileSpy);

    // Each token set should generate both assets/scss/ and bundles/ files
    const baseCalls = expectedEmittedFiles.length * 2;
    const extraCalls =
      (expectedEmittedPublicApiFile ? 1 : 0) +
      (expectedEmittedPublicApiJsonFile ? 1 : 0) +
      (expectedEmittedPublicApiStylesJsonFile ? 1 : 0);
    expect(emitFileSpy).toHaveBeenCalledTimes(baseCalls + extraCalls);

    for (const expectedFile of expectedEmittedFiles) {
      // Check for assets/scss/ file
      expect(emitFileSpy).toHaveBeenCalledWith({
        type: 'asset',
        fileName: expectedFile.fileName,
        source: expectedFile.source,
      });

      // Check for corresponding bundles/ file
      const bundleFileName = expectedFile.fileName.replace(
        'assets/scss/',
        'bundles/',
      );
      expect(emitFileSpy).toHaveBeenCalledWith({
        type: 'asset',
        fileName: bundleFileName,
        source: expectedFile.source,
      });
    }

    if (expectedEmittedPublicApiFile) {
      expect(emitFileSpy).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'bundles/public-api.css',
        source: expectedEmittedPublicApiFile.source,
      });
    }

    if (expectedEmittedPublicApiJsonFile) {
      expect(emitFileSpy).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'bundles/public-api-tokens.json',
        source: expectedEmittedPublicApiJsonFile.source,
      });
    }

    if (expectedEmittedPublicApiStylesJsonFile) {
      expect(emitFileSpy).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'bundles/public-api-styles.json',
        source: expectedEmittedPublicApiStylesJsonFile.source,
      });
    }
  }

  it('should create style files for each token set provided', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'muted',
          selector: '.sky-theme-muted',
          path: 'base-muted.json',
          outputPath: 'muted.css',
          referenceTokens: [
            {
              name: 'muted-colors',
              path: 'muted-colors.json',
            },
            {
              name: 'muted-dark-colors',
              path: 'muted-dark-colors.json',
              selector: '.sky-theme-mode-dark',
            },
          ],
        },
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/muted.css',
        source: `.sky-theme-muted {
  --modern-color-black: #000000;
  --modern-color-gray-1: #e2e3e4;
  --modern-color-red-1: #f7a08f;
  --modern-color-red-2: #ef4044;
  --modern-color-white: #ffffff;
  --modern-space-lg: 20px;
  --modern-space-md: 15px;
  --modern-space-s: 10px;
}
.sky-theme-muted {
  --sky-color-background-danger: var(--modern-color-red-2);
  --sky-color-text-default: var(--modern-color-gray-1);
}
.sky-theme-muted.sky-theme-mode-dark {
  --sky-color-background-danger: var(--modern-color-black);
  --sky-color-text-default: var(--modern-color-red-1);
}
`,
      },
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];
    await validate(tokenConfig, expectedEmittedFiles);
  });

  it('should create the public API styles when provided', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
`,
    };
    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };
    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should include ungrouped tokens at root level in JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-tokens-with-ungrouped',
              path: 'public-tokens-with-ungrouped.json',
              docsPath: 'public-tokens-with-ungrouped-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* Small spacing value. */
  --sky-theme-spacing-small: var(--rainbow-space-s);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
`,
    };
    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          tokens: [
            {
              name: 'Small Spacing',
              customProperty: '--sky-theme-spacing-small',
              description: 'Small spacing value.',
            },
          ],
          groups: [
            {
              groupName: 'Colors',
              groups: [
                {
                  groupName: 'Text Colors',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };
    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should fall back to token name and omit description when readableName and description $extensions are absent', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors-no-name-description',
              path: 'public-colors-no-name-description.json',
              docsPath: 'public-colors-no-name-description-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  --sky-theme-color-text-minimal: var(--sky-color-text-default);
}
`,
    };
    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              groups: [
                {
                  groupName: 'Text Colors',
                  tokens: [
                    {
                      name: 'sky-theme-color-text-minimal',
                      customProperty: '--sky-theme-color-text-minimal',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };
    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should deduplicate docs from multiple public token sets in JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
            {
              name: 'public-colors-text-only',
              path: 'public-colors-text-only.json',
              docsPath: 'public-colors-text-only-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
.sky-theme-rainbow {
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
`,
    };
    // The JSON should contain each token exactly once despite it appearing in both sets.
    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };
    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should include the correct media queries for breakpoints', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'responsive-rainbow',
          selector: '.sky-theme-rainbow',
          outputPath: 'responsive-rainbow.css',
          path: 'base-rainbow.json',
          referenceTokens: [
            {
              name: 'rainbow-colors-xs',
              responsive: {
                breakpoint: 'xs',
              },
              path: 'responsive-rainbow-colors-xs.json',
            },
            {
              name: 'rainbow-colors-md',
              responsive: {
                breakpoint: 'm',
              },
              path: 'responsive-rainbow-colors-m.json',
            },
            {
              name: 'rainbow-colors-sm',
              responsive: {
                breakpoint: 's',
              },
              path: 'responsive-rainbow-colors-s.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/responsive-rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-text-default: var(--rainbow-color-red-1);
}
@media (min-width: 768px) {
.sky-theme-rainbow {
  --sky-color-text-default: var(--rainbow-color-gray-2);
}
}
@media (min-width: 992px) {
.sky-theme-rainbow {
  --sky-color-text-default: var(--rainbow-color-gray-1);
}
}
`,
      },
    ];
    await validate(tokenConfig, expectedEmittedFiles);
  });

  it('should add units to unitless zero values', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'zeroes',
          selector: '.sky-theme-zero',
          outputPath: 'zeroes.css',
          path: 'zeroes.json',
          referenceTokens: [],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'bundles/zeroes.css',
        source: `.sky-theme-zero {
  --zeroTest-space-1: 0rem;
  --zeroTest-space-2: 0rem;
  --zeroTest-space-3: 0rem;
  --zeroTest-space-4: 0rem;
  --zeroTest-space-5: 0px;
  --zeroTest-space-6: 0;
  --zeroTest-space-7: #000000;
}
`,
      },
    ];

    await validate(tokenConfig, expectedEmittedFiles);
  });

  it('should add font declarations', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'zeroes',
          selector: '.sky-theme-zero',
          outputPath: 'zeroes.css',
          path: 'zeroes.json',
          referenceTokens: [],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/zeroes.css',
        source: `@font-face {
  font-family: Test;
  src: url('../test.tff');
}

.sky-theme-zero {
  --zeroTest-space-1: 0rem;
  --zeroTest-space-2: 0rem;
  --zeroTest-space-3: 0rem;
  --zeroTest-space-4: 0rem;
  --zeroTest-space-5: 0px;
  --zeroTest-space-6: 0;
  --zeroTest-space-7: #000000;
}
`,
      },
    ];

    const assetsCssMock = (basePath?: string) =>
      Promise.resolve(`@font-face {
  font-family: Test;
  src: url('${basePath}test.tff');
}`);

    await validate(tokenConfig, expectedEmittedFiles, assetsCssMock);
  });

  it('should generate CSS for grouped public classes with descriptions and cssProperties', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-grouped',
              path: 'public-classes-grouped.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-margin-top-xs {
  margin-top: 0.5rem;
}
.sky-theme-margin-top-s {
  margin-top: 1rem;
}
`,
    };

    const expectedEmittedPublicApiStylesGroupedJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              name: 'Margin top',
              description:
                'Use these classes to add a top margin to an element.',
              styles: [
                {
                  name: 'Top x-small',
                  className: 'sky-theme-margin-top-xs',
                  description: 'Top x-small margin.',
                  properties: { 'margin-top': '0.5rem' },
                },
                {
                  name: 'Top small',
                  className: 'sky-theme-margin-top-s',
                  properties: { 'margin-top': '1rem' },
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      undefined,
      expectedEmittedPublicApiStylesGroupedJsonFile,
    );
  });

  it('should generate CSS for ungrouped classes and deeply nested subgroups', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-nested',
              path: 'public-classes-nested.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-ungrouped {
  display: block;
}
.sky-theme-text-default {
  color: black;
}
`,
    };

    const expectedEmittedPublicApiStylesNestedJsonFile = {
      source: JSON.stringify(
        {
          styles: [
            {
              name: 'Ungrouped',
              className: 'sky-theme-ungrouped',
              description: 'An ungrouped class.',
              properties: { display: 'block' },
            },
          ],
          groups: [
            {
              name: 'Colors',
              groups: [
                {
                  name: 'Text Colors',
                  description: 'Text color classes.',
                  styles: [
                    {
                      name: 'Default Text',
                      className: 'sky-theme-text-default',
                      properties: { color: 'black' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      undefined,
      expectedEmittedPublicApiStylesNestedJsonFile,
    );
  });

  it('should throw when a class customProperty references a custom property not defined in publicTokens', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-invalid-refs',
              path: 'public-classes-invalid-refs.json',
            },
          ],
        },
      ],
    };
    vi.spyOn(assetsUtils, 'generateAssetsCss').mockResolvedValue('');
    const plugin = buildStyleDictionaryPlugin(tokenConfig);
    const emitFileSpy = vi.fn();
    await expect(callGenerateBundle(plugin, emitFileSpy)).rejects.toThrow(
      'Invalid CSS custom property references in "public-classes-invalid-refs":\n  .sky-theme-bad-class: "--sky-theme-nonexistent-token" is not defined in publicTokens',
    );
  });

  it('should accept classes that reference custom properties defined in publicTokens', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-valid-refs',
              path: 'public-classes-valid-refs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
.sky-theme-text-default {
  color: var(--sky-theme-color-text-default);
}
`,
    };

    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    const expectedEmittedPublicApiStylesValidRefsJsonFile = {
      source: JSON.stringify(
        {
          styles: [
            {
              name: 'Default Text Color',
              className: 'sky-theme-text-default',
              description: 'Applies the default text color.',
              properties: { color: 'var(--sky-theme-color-text-default)' },
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
      expectedEmittedPublicApiStylesValidRefsJsonFile,
    );
  });

  it('should deduplicate classes across multiple publicClasses sets in JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-grouped',
              path: 'public-classes-grouped.json',
            },
            {
              // This set overlaps on sky-theme-margin-top-xs; the first occurrence wins.
              name: 'public-classes-grouped-overlap',
              path: 'public-classes-grouped-overlap.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    // Both class sets emit their own CSS block into bundles/public-api.css; dedup only applies to the JSON.
    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-margin-top-xs {
  margin-top: 0.5rem;
}
.sky-theme-margin-top-s {
  margin-top: 1rem;
}
.sky-theme-margin-top-l {
  margin-top: 2rem;
}
`,
    };

    // The JSON should contain sky-theme-margin-top-xs exactly once (first occurrence wins),
    // sky-theme-margin-top-s from the first set, and sky-theme-margin-top-l from the second.
    const expectedEmittedPublicApiStylesJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              name: 'Margin top',
              description:
                'Use these classes to add a top margin to an element.',
              styles: [
                {
                  name: 'Top x-small',
                  className: 'sky-theme-margin-top-xs',
                  description: 'Top x-small margin.',
                  properties: { 'margin-top': '0.5rem' },
                },
                {
                  name: 'Top small',
                  className: 'sky-theme-margin-top-s',
                  properties: { 'margin-top': '1rem' },
                },
                {
                  name: 'Top large',
                  className: 'sky-theme-margin-top-l',
                  properties: { 'margin-top': '2rem' },
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      undefined,
      expectedEmittedPublicApiStylesJsonFile,
    );
  });

  it('should include deprecated-only classes (no className or properties) in the JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-with-deprecated',
              path: 'public-classes-with-deprecated.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    // The deprecated-only class has no CSS output; only the normal class appears.
    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
.sky-theme-text-default {
  color: var(--sky-theme-color-text-default);
}
`,
    };

    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    // The JSON should contain both the normal class and the deprecated-only class.
    const expectedEmittedPublicApiStylesJsonFile = {
      source: JSON.stringify(
        {
          styles: [
            {
              name: 'Default Text Color',
              className: 'sky-theme-text-default',
              description: 'Applies the default text color.',
              properties: { color: 'var(--sky-theme-color-text-default)' },
            },
            {
              name: 'Old Text Color',
              deprecatedClassNames: ['sky-theme-old-text-color'],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
      expectedEmittedPublicApiStylesJsonFile,
    );
  });

  it('should include deprecated-only tokens (no customProperty) in the docs JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-with-deprecated-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
`,
    };

    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
          tokens: [
            {
              name: 'Old Token',
              deprecatedCustomProperties: ['--sky-theme-old-token'],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should apply demoMetadata inheritance from groups to tokens in the JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-demo-metadata-docs.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              demoMetadata: { type: 'color', background: 'light' },
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  // Inherits type from Colors, background overridden by Text Colors
                  demoMetadata: { type: 'color', background: 'dark' },
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                      // Inherits type from Colors, background overridden by Text Colors
                      demoMetadata: { type: 'color', background: 'dark' },
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                      // Inherits type & background from Colors, token adds text
                      demoMetadata: {
                        type: 'color',
                        background: 'light',
                        text: 'Danger!',
                      },
                    },
                  ],
                  // Inherits type & background from Colors; appears after tokens since it was not set originally
                  demoMetadata: { type: 'color', background: 'light' },
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };
    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      {
        source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
`,
      },
      expectedEmittedPublicApiJsonFile,
    );
  });

  it('should throw when docs reference a custom property not generated in the public API', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors-text-only',
              path: 'public-colors-text-only.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
        },
      ],
    };
    vi.spyOn(assetsUtils, 'generateAssetsCss').mockResolvedValue('');
    const plugin = buildStyleDictionaryPlugin(tokenConfig);
    const emitFileSpy = vi.fn();
    await expect(callGenerateBundle(plugin, emitFileSpy)).rejects.toThrow(
      'Token docs validation failed for "public-colors-text-only"',
    );
  });

  it('should include excludeFromDocs styles in CSS but not in the JSON output', async () => {
    const tokenConfig: TokenConfig = {
      rootPath: 'src/plugins/fixtures/',
      projectName: 'skyux-brand-test',
      tokenSets: [
        {
          name: 'rainbow',
          selector: '.sky-theme-rainbow',
          path: 'base-rainbow.json',
          outputPath: 'rainbow.css',
          referenceTokens: [
            {
              name: 'rainbow-colors',
              path: 'rainbow-colors.json',
            },
          ],
          publicTokens: [
            {
              name: 'public-colors',
              path: 'public-colors.json',
              docsPath: 'public-colors-docs.json',
            },
          ],
          publicStyles: [
            {
              name: 'public-classes-with-excluded',
              path: 'public-classes-with-excluded.json',
            },
          ],
        },
      ],
    };

    const expectedEmittedFiles: { fileName: string; source: string }[] = [
      {
        fileName: 'assets/scss/rainbow.css',
        source: `.sky-theme-rainbow {
  --rainbow-color-gray-1: #e2e3e7;
  --rainbow-color-gray-2: #c0c2c5;
  --rainbow-color-red-1: #fc0330;
  --rainbow-color-red-2: #8a2538;
  --rainbow-space-s: 10px;
}
.sky-theme-rainbow {
  --sky-color-background-danger: var(--rainbow-color-gray-1);
  --sky-color-text-default: var(--rainbow-color-red-1);
}
`,
      },
    ];

    // Both styles (public and excludeFromDocs) should appear in the CSS.
    const expectedEmittedPublicApiFile = {
      source: `.sky-theme-rainbow {
  /* The background color for danger elements. */
  --sky-theme-color-background-danger: var(--sky-color-background-danger);
  /* The default text color. */
  --sky-theme-color-text-default: var(--sky-color-text-default);
}
.sky-theme-text-default {
  color: var(--sky-theme-color-text-default);
}
.sky-theme-text-internal {
  color: var(--sky-theme-color-text-default);
}
`,
    };

    // Only the public style (not the excludeFromDocs one) should appear in the JSON.
    const expectedEmittedPublicApiStylesJsonFile = {
      source: JSON.stringify(
        {
          styles: [
            {
              name: 'Default Text Color',
              className: 'sky-theme-text-default',
              description: 'Applies the default text color.',
              properties: { color: 'var(--sky-theme-color-text-default)' },
            },
          ],
        },
        null,
        2,
      ),
    };

    const expectedEmittedPublicApiJsonFile = {
      source: JSON.stringify(
        {
          groups: [
            {
              groupName: 'Colors',
              description: 'All color tokens.',
              groups: [
                {
                  groupName: 'Text Colors',
                  description: 'Text color tokens.',
                  tokens: [
                    {
                      name: 'Default Text',
                      customProperty: '--sky-theme-color-text-default',
                      description: 'The default text color.',
                      deprecatedCustomProperties: ['--old-text-color'],
                    },
                  ],
                },
                {
                  groupName: 'Background Colors',
                  description: 'Background color tokens.',
                  tokens: [
                    {
                      name: 'Danger Background',
                      customProperty: '--sky-theme-color-background-danger',
                      description: 'The background color for danger elements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    };

    await validate(
      tokenConfig,
      expectedEmittedFiles,
      undefined,
      expectedEmittedPublicApiFile,
      expectedEmittedPublicApiJsonFile,
      expectedEmittedPublicApiStylesJsonFile,
    );
  });

  describe('transform', () => {
    async function callTransform(
      plugin: ReturnType<typeof buildStyleDictionaryPlugin>,
      id: string,
    ): Promise<string | undefined> {
      if (plugin.transform) {
        return (
          plugin.transform as (
            code: string,
            id: string,
          ) => Promise<string | undefined>
        ).call({ addWatchFile: () => undefined }, '', id);
      }
      return undefined;
    }

    it('should include public styles CSS in the dev token output', async () => {
      const tokenConfig: TokenConfig = {
        rootPath: 'src/plugins/fixtures/',
        projectName: 'skyux-brand-test',
        tokenSets: [
          {
            name: 'rainbow',
            selector: '.sky-theme-rainbow',
            path: 'base-rainbow.json',
            outputPath: 'rainbow.css',
            referenceTokens: [
              {
                name: 'rainbow-colors',
                path: 'rainbow-colors.json',
              },
            ],
            publicTokens: [
              {
                name: 'public-colors',
                path: 'public-colors.json',
                docsPath: 'public-colors-docs.json',
              },
            ],
            publicStyles: [
              {
                name: 'public-classes-valid-refs',
                path: 'public-classes-valid-refs.json',
              },
            ],
          },
        ],
      };

      vi.spyOn(assetsUtils, 'generateAssetsCss').mockResolvedValue('');
      const plugin = buildStyleDictionaryPlugin(tokenConfig);
      const result = await callTransform(plugin, 'src/dev/tokens.css');

      expect(result).toContain('.sky-theme-text-default {');
      expect(result).toContain('color: var(--sky-theme-color-text-default);');
    });

    it('should include excludeFromDocs styles in the dev token output', async () => {
      const tokenConfig: TokenConfig = {
        rootPath: 'src/plugins/fixtures/',
        projectName: 'skyux-brand-test',
        tokenSets: [
          {
            name: 'rainbow',
            selector: '.sky-theme-rainbow',
            path: 'base-rainbow.json',
            outputPath: 'rainbow.css',
            referenceTokens: [
              {
                name: 'rainbow-colors',
                path: 'rainbow-colors.json',
              },
            ],
            publicTokens: [
              {
                name: 'public-colors',
                path: 'public-colors.json',
                docsPath: 'public-colors-docs.json',
              },
            ],
            publicStyles: [
              {
                name: 'public-classes-with-excluded',
                path: 'public-classes-with-excluded.json',
              },
            ],
          },
        ],
      };

      vi.spyOn(assetsUtils, 'generateAssetsCss').mockResolvedValue('');
      const plugin = buildStyleDictionaryPlugin(tokenConfig);
      const result = await callTransform(plugin, 'src/dev/tokens.css');

      expect(result).toContain('.sky-theme-text-default {');
      expect(result).toContain('.sky-theme-text-internal {');
    });

    it('should return undefined for non-token files', async () => {
      const tokenConfig: TokenConfig = {
        rootPath: 'src/plugins/fixtures/',
        projectName: 'skyux-brand-test',
        tokenSets: [
          {
            name: 'rainbow',
            selector: '.sky-theme-rainbow',
            path: 'base-rainbow.json',
            outputPath: 'rainbow.css',
            referenceTokens: [],
          },
        ],
      };

      const plugin = buildStyleDictionaryPlugin(tokenConfig);
      const result = await callTransform(plugin, 'src/some-other-file.ts');

      expect(result).toBeUndefined();
    });
  });
});
