import { describe, expect, it } from 'vitest';

import type { PublicApiTokens } from '../../types/public-api-tokens.js';

import {
  applyTokenDemoMetadataInheritance,
  collectPublicTokenCustomProperties,
  mergePublicApiResults,
  validatePublicApiTokensDocs,
} from './public-api-tokens-utils.mjs';

describe('collectPublicTokenCustomProperties', () => {
  it('should collect top-level token custom properties', () => {
    const api: PublicApiTokens = {
      tokens: [
        { name: 'A', customProperty: '--a' },
        { name: 'B', customProperty: '--b' },
      ],
    };

    const result = collectPublicTokenCustomProperties(api);

    expect(result).toEqual(new Set(['--a', '--b']));
  });

  it('should collect custom properties from groups', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          tokens: [{ name: 'A', customProperty: '--color-a' }],
          groups: [
            {
              groupName: 'Text',
              tokens: [{ name: 'B', customProperty: '--color-text-b' }],
            },
          ],
        },
      ],
    };

    const result = collectPublicTokenCustomProperties(api);

    expect(result).toEqual(new Set(['--color-a', '--color-text-b']));
  });

  it('should return an empty set for empty input', () => {
    const result = collectPublicTokenCustomProperties({});
    expect(result.size).toBe(0);
  });

  it('should accumulate into a passed-in set', () => {
    const existing = new Set(['--existing']);
    const api: PublicApiTokens = {
      tokens: [{ name: 'A', customProperty: '--a' }],
    };

    const result = collectPublicTokenCustomProperties(api, existing);

    expect(result).toBe(existing);
    expect(result).toEqual(new Set(['--existing', '--a']));
  });

  it('should skip tokens without a customProperty', () => {
    const api: PublicApiTokens = {
      tokens: [
        { name: 'A', customProperty: '--a' },
        { name: 'Deprecated Token', deprecatedCustomProperties: ['--old'] },
      ],
    };

    const result = collectPublicTokenCustomProperties(api);

    expect(result).toEqual(new Set(['--a']));
  });

  it('should skip tokens without a customProperty inside groups', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          tokens: [
            { name: 'A', customProperty: '--color-a' },
            {
              name: 'Deprecated Color',
              deprecatedCustomProperties: ['--old-color'],
            },
          ],
        },
      ],
    };

    const result = collectPublicTokenCustomProperties(api);

    expect(result).toEqual(new Set(['--color-a']));
  });
});

describe('validatePublicApiTokensDocs', () => {
  it('should not throw when docs and generated custom properties match', () => {
    const docs = new Set(['--a', '--b']);
    const generated = new Set(['--a', '--b']);

    expect(() => {
      validatePublicApiTokensDocs(docs, generated, 'test-set');
    }).not.toThrow();
  });

  it('should throw when docs contain a custom property not in the generated set', () => {
    const docs = new Set(['--a', '--b', '--extra']);
    const generated = new Set(['--a', '--b']);

    expect(() => {
      validatePublicApiTokensDocs(docs, generated, 'test-set');
    }).toThrow(
      'Token docs validation failed for "test-set":\n  "--extra" is in the docs but is not generated in the public API',
    );
  });

  it('should throw when a generated custom property is missing from the docs', () => {
    const docs = new Set(['--a']);
    const generated = new Set(['--a', '--b']);

    expect(() => {
      validatePublicApiTokensDocs(docs, generated, 'test-set');
    }).toThrow(
      'Token docs validation failed for "test-set":\n  "--b" is generated in the public API but is not included in the docs',
    );
  });

  it('should report all mismatches in a single error', () => {
    const docs = new Set(['--a', '--extra-1', '--extra-2']);
    const generated = new Set(['--a', '--missing']);

    expect(() => {
      validatePublicApiTokensDocs(docs, generated, 'test-set');
    }).toThrow(
      'Token docs validation failed for "test-set":\n  "--extra-1" is in the docs but is not generated in the public API\n  "--extra-2" is in the docs but is not generated in the public API\n  "--missing" is generated in the public API but is not included in the docs',
    );
  });

  it('should not throw when both sets are empty', () => {
    expect(() => {
      validatePublicApiTokensDocs(new Set(), new Set(), 'test-set');
    }).not.toThrow();
  });
});

describe('mergePublicApiResults', () => {
  it('should merge top-level tokens without duplicates', () => {
    const target: PublicApiTokens = {
      tokens: [
        { name: 'A', customProperty: '--a' },
        { name: 'B', customProperty: '--b' },
      ],
    };
    const source: PublicApiTokens = {
      tokens: [
        { name: 'B duplicate', customProperty: '--b' },
        { name: 'C', customProperty: '--c' },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.tokens).toHaveLength(3);
    expect(target.tokens![0].name).toBe('A');
    expect(target.tokens![1].name).toBe('B');
    expect(target.tokens![2].name).toBe('C');
  });

  it('should initialize target tokens when missing', () => {
    const target: PublicApiTokens = {};
    const source: PublicApiTokens = {
      tokens: [{ name: 'A', customProperty: '--a' }],
    };

    mergePublicApiResults(target, source);

    expect(target.tokens).toHaveLength(1);
  });

  it('should merge groups by groupName', () => {
    const target: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          tokens: [{ name: 'A', customProperty: '--a' }],
        },
      ],
    };
    const source: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          tokens: [
            { name: 'A dup', customProperty: '--a' },
            { name: 'B', customProperty: '--b' },
          ],
        },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.groups).toHaveLength(1);
    expect(target.groups![0].tokens).toHaveLength(2);
    expect(target.groups![0].tokens![0].name).toBe('A');
  });

  it('should add new groups from source', () => {
    const target: PublicApiTokens = {
      groups: [{ groupName: 'Colors' }],
    };
    const source: PublicApiTokens = {
      groups: [{ groupName: 'Spacing' }],
    };

    mergePublicApiResults(target, source);

    expect(target.groups).toHaveLength(2);
  });

  it('should fill in description when target group has none', () => {
    const target: PublicApiTokens = {
      groups: [{ groupName: 'Colors' }],
    };
    const source: PublicApiTokens = {
      groups: [{ groupName: 'Colors', description: 'All colors.' }],
    };

    mergePublicApiResults(target, source);

    expect(target.groups![0].description).toBe('All colors.');
  });

  it('should not overwrite existing description', () => {
    const target: PublicApiTokens = {
      groups: [{ groupName: 'Colors', description: 'Original.' }],
    };
    const source: PublicApiTokens = {
      groups: [{ groupName: 'Colors', description: 'Replacement.' }],
    };

    mergePublicApiResults(target, source);

    expect(target.groups![0].description).toBe('Original.');
  });

  it('should recursively merge nested subgroups', () => {
    const target: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          groups: [
            {
              groupName: 'Text',
              tokens: [{ name: 'A', customProperty: '--a' }],
            },
          ],
        },
      ],
    };
    const source: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          groups: [
            {
              groupName: 'Text',
              tokens: [{ name: 'B', customProperty: '--b' }],
            },
          ],
        },
      ],
    };

    mergePublicApiResults(target, source);

    const textGroup = target.groups![0].groups![0];
    expect(textGroup.tokens).toHaveLength(2);
  });

  it('should not deduplicate distinct deprecated-only tokens with no customProperty', () => {
    const target: PublicApiTokens = {
      tokens: [
        { name: 'Deprecated A', deprecatedCustomProperties: ['--old-a'] },
      ],
    };
    const source: PublicApiTokens = {
      tokens: [
        { name: 'Deprecated A', deprecatedCustomProperties: ['--old-a-dup'] },
        { name: 'Deprecated B', deprecatedCustomProperties: ['--old-b'] },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.tokens).toHaveLength(3);
  });

  it('should fill in demoMetadata on a merged group when target has none', () => {
    const target: PublicApiTokens = {
      groups: [{ groupName: 'Colors', tokens: [] }],
    };
    const source: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          demoMetadata: { background: 'dark' },
          tokens: [],
        },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.groups![0].demoMetadata).toEqual({ background: 'dark' });
  });

  it('should not overwrite existing demoMetadata on a merged group', () => {
    const target: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          demoMetadata: { background: 'light' },
          tokens: [],
        },
      ],
    };
    const source: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          demoMetadata: { background: 'dark' },
          tokens: [],
        },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.groups![0].demoMetadata).toEqual({ background: 'light' });
  });
});

describe('applyTokenDemoMetadataInheritance', () => {
  it('should inherit group demoMetadata on a token that has none', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          demoMetadata: { background: 'dark' },
          tokens: [{ name: 'A', customProperty: '--a' }],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].tokens![0].demoMetadata).toEqual({
      background: 'dark',
    });
  });

  it('should merge group and token demoMetadata with token taking precedence', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          demoMetadata: { background: 'dark', type: 'color' },
          tokens: [
            {
              name: 'A',
              customProperty: '--a',
              demoMetadata: { type: 'text' },
            },
          ],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].tokens![0].demoMetadata).toEqual({
      background: 'dark',
      type: 'text',
    });
  });

  it('should inherit demoMetadata from grandparent groups', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Background',
          demoMetadata: { type: 'background-color' },
          groups: [
            {
              groupName: 'Container',
              tokens: [{ name: 'A', customProperty: '--a' }],
            },
          ],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].groups![0].tokens![0].demoMetadata).toEqual({
      type: 'background-color',
    });
  });

  it('should let child group override grandparent demoMetadata fields', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Background',
          demoMetadata: { type: 'background-color', background: 'light' },
          groups: [
            {
              groupName: 'Container',
              demoMetadata: { background: 'dark' },
              tokens: [{ name: 'A', customProperty: '--a' }],
            },
          ],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].groups![0].tokens![0].demoMetadata).toEqual({
      type: 'background-color',
      background: 'dark',
    });
  });

  it('should not affect top-level tokens', () => {
    const api: PublicApiTokens = {
      tokens: [{ name: 'A', customProperty: '--a' }],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.tokens![0].demoMetadata).toBeUndefined();
  });

  it('should not add demoMetadata when no group has it', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Colors',
          tokens: [{ name: 'A', customProperty: '--a' }],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].tokens![0].demoMetadata).toBeUndefined();
  });

  it('should set demoMetadata on a child group that inherits from its parent', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Background',
          demoMetadata: { type: 'background-color' },
          groups: [
            {
              groupName: 'Container',
              tokens: [{ name: 'A', customProperty: '--a' }],
            },
          ],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].groups![0].demoMetadata).toEqual({
      type: 'background-color',
    });
  });

  it('should set merged demoMetadata on a child group that partially overrides its parent', () => {
    const api: PublicApiTokens = {
      groups: [
        {
          groupName: 'Background',
          demoMetadata: { type: 'background-color', background: 'light' },
          groups: [
            {
              groupName: 'Container',
              demoMetadata: { background: 'dark' },
              tokens: [{ name: 'A', customProperty: '--a' }],
            },
          ],
        },
      ],
    };

    applyTokenDemoMetadataInheritance(api);

    expect(api.groups![0].groups![0].demoMetadata).toEqual({
      type: 'background-color',
      background: 'dark',
    });
  });
});
