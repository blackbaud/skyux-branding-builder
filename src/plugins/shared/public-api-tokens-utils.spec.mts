import { describe, expect, it } from 'vitest';
import type { Token, TransformedTokens } from 'style-dictionary';

import type { PublicApiTokens } from '../../types/public-api-tokens.js';

import {
  buildPublicApiGroups,
  collectPublicTokenCustomProperties,
  mergePublicApiResults,
} from './public-api-tokens-utils.mjs';

const DOCS_NS = 'com.blackbaud.developer.docs';

/** Minimal token stub that satisfies the fields read by the utils. */
function mockToken(overrides: {
  name: string;
  path: string[];
  $description?: string;
  docsExt?: Record<string, unknown>;
}): Token {
  return {
    name: overrides.name,
    path: overrides.path,
    $description: overrides.$description,
    $extensions: overrides.docsExt
      ? { [DOCS_NS]: overrides.docsExt }
      : undefined,
  } as unknown as Token;
}

/**
 * Build a minimal token tree that mirrors the nesting described by each
 * token's `path` array plus optional `$extensions`/`$description` on
 * intermediate nodes (groups).
 */
function buildTree(
  tokens: Token[],
  groupAnnotations: Record<
    string,
    {
      groupName?: string;
      description?: string;
      demoMetadata?: Record<string, unknown>;
    }
  > = {},
): TransformedTokens {
  const tree: TransformedTokens = {};

  for (const token of tokens) {
    let cursor: Record<string, unknown> = tree;

    for (let i = 0; i < token.path.length; i++) {
      const segment = token.path[i];
      const fullPath = token.path.slice(0, i + 1).join('.');

      if (i === token.path.length - 1) {
        // leaf — place the token itself
        cursor[segment] = token;
      } else {
        if (!cursor[segment]) {
          const node: Record<string, unknown> = {};
          const ann = groupAnnotations[fullPath];
          if (ann?.groupName) {
            const ext: Record<string, unknown> = { groupName: ann.groupName };
            if (ann.demoMetadata) {
              ext.demoMetadata = ann.demoMetadata;
            }
            node.$extensions = { [DOCS_NS]: ext };
          }
          if (ann?.description) {
            node.$description = ann.description;
          }
          cursor[segment] = node;
        }
        cursor = cursor[segment] as Record<string, unknown>;
      }
    }
  }

  return tree as unknown as TransformedTokens;
}

describe('buildPublicApiGroups', () => {
  it('should place ungrouped tokens in the top-level tokens array', () => {
    const t = mockToken({
      name: 'sky-theme-spacing-small',
      path: ['theme', 'spacing', 'small'],
      $description: 'Small spacing.',
      docsExt: { name: 'Small Spacing' },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens).toEqual([
      {
        name: 'Small Spacing',
        customProperty: '--sky-theme-spacing-small',
        description: 'Small spacing.',
      },
    ]);
    expect(result.groups).toBeUndefined();
  });

  it('should fall back to token.name when docs name is missing', () => {
    const t = mockToken({
      name: 'sky-theme-spacing-small',
      path: ['theme', 'spacing', 'small'],
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].name).toBe('sky-theme-spacing-small');
  });

  it('should include deprecatedCustomProperties when present', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: {
        name: 'Default Text',
        deprecatedCustomProperties: ['--old-text-color'],
      },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].deprecatedCustomProperties).toEqual([
      '--old-text-color',
    ]);
  });

  it('should include obsoleteCustomProperties when present', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: {
        name: 'Default Text',
        obsoleteCustomProperties: ['--removed-text-color'],
      },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].obsoleteCustomProperties).toEqual([
      '--removed-text-color',
    ]);
  });

  it('should include cssProperty when present', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: {
        name: 'Default Text',
        cssProperty: 'color',
      },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].cssProperty).toBe('color');
  });

  it('should include demoMetadata when present', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: {
        name: 'Default Text',
        demoMetadata: {
          type: 'text',
          background: 'dark',
          color: '#fff',
          text: 'Hello',
        },
      },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].demoMetadata).toEqual({
      type: 'text',
      background: 'dark',
      color: '#fff',
      text: 'Hello',
    });
  });

  it('should nest tokens under groups from ancestor extensions', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      $description: 'The default text color.',
      docsExt: { name: 'Default Text' },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Colors',
        description: 'All color tokens.',
      },
      'theme.color.text': {
        groupName: 'Text Colors',
        description: 'Text color tokens.',
      },
    });

    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens).toBeUndefined();
    expect(result.groups).toHaveLength(1);

    const colorsGroup = result.groups![0];
    expect(colorsGroup.groupName).toBe('Colors');
    expect(colorsGroup.description).toBe('All color tokens.');
    expect(colorsGroup.groups).toHaveLength(1);

    const textGroup = colorsGroup.groups![0];
    expect(textGroup.groupName).toBe('Text Colors');
    expect(textGroup.tokens).toHaveLength(1);
    expect(textGroup.tokens![0].name).toBe('Default Text');
  });

  it('should group multiple tokens under the same group', () => {
    const t1 = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: { name: 'Default Text' },
    });
    const t2 = mockToken({
      name: 'sky-theme-color-text-secondary',
      path: ['theme', 'color', 'text', 'secondary'],
      docsExt: { name: 'Secondary Text' },
    });

    const tree = buildTree([t1, t2], {
      'theme.color': { groupName: 'Colors' },
      'theme.color.text': { groupName: 'Text Colors' },
    });

    const result = buildPublicApiGroups([t1, t2], tree);

    const textGroup = result.groups![0].groups![0];
    expect(textGroup.tokens).toHaveLength(2);
  });

  it('should handle tokens with no description', () => {
    const t = mockToken({
      name: 'sky-theme-spacing-small',
      path: ['theme', 'spacing', 'small'],
      docsExt: { name: 'Small Spacing' },
    });

    const tree = buildTree([t]);
    const result = buildPublicApiGroups([t], tree);

    expect(result.tokens![0].description).toBeUndefined();
  });

  it('should set demoMetadata on the group from ancestor extensions', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'text', 'default'],
      docsExt: { name: 'Default Text' },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Colors',
        demoMetadata: { background: 'dark' },
      },
    });
    const result = buildPublicApiGroups([t], tree);

    expect(result.groups![0].demoMetadata).toEqual({ background: 'dark' });
  });

  it('should inherit group demoMetadata on a token that has none of its own', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'default'],
      docsExt: { name: 'Default Text' },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Colors',
        demoMetadata: { background: 'dark' },
      },
    });
    const result = buildPublicApiGroups([t], tree);

    expect(result.groups![0].tokens![0].demoMetadata).toEqual({
      background: 'dark',
    });
  });

  it('should prefer the token demoMetadata over the group demoMetadata', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'default'],
      docsExt: { name: 'Default Text', demoMetadata: { background: 'light' } },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Colors',
        demoMetadata: { background: 'dark' },
      },
    });
    const result = buildPublicApiGroups([t], tree);

    // Token's background overrides the group's background.
    expect(result.groups![0].tokens![0].demoMetadata).toEqual({
      background: 'light',
    });
  });

  it('should merge group and token demoMetadata with token values taking precedence', () => {
    const t = mockToken({
      name: 'sky-theme-color-text-default',
      path: ['theme', 'color', 'default'],
      docsExt: { name: 'Default Text', demoMetadata: { type: 'text' } },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Colors',
        demoMetadata: { background: 'dark', type: 'color' },
      },
    });
    const result = buildPublicApiGroups([t], tree);

    // Token's type overrides group's type; group's background is inherited.
    expect(result.groups![0].tokens![0].demoMetadata).toEqual({
      background: 'dark',
      type: 'text',
    });
  });

  it('should inherit demoMetadata from ancestor groups (grandparent)', () => {
    const t = mockToken({
      name: 'sky-theme-color-bg-container-default',
      path: ['theme', 'color', 'container', 'default'],
      docsExt: { name: 'Container Default' },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Background',
        demoMetadata: { type: 'background-color' },
      },
      'theme.color.container': { groupName: 'Container' },
    });
    const result = buildPublicApiGroups([t], tree);

    // Token inherits grandparent's demoMetadata even though direct parent has none.
    expect(
      result.groups![0].groups![0].tokens![0].demoMetadata,
    ).toEqual({ type: 'background-color' });
  });

  it('should let a child group override a grandparent demoMetadata field', () => {
    const t = mockToken({
      name: 'sky-theme-color-bg-container-default',
      path: ['theme', 'color', 'container', 'default'],
      docsExt: { name: 'Container Default' },
    });

    const tree = buildTree([t], {
      'theme.color': {
        groupName: 'Background',
        demoMetadata: { type: 'background-color', background: 'light' },
      },
      'theme.color.container': {
        groupName: 'Container',
        demoMetadata: { background: 'dark' },
      },
    });
    const result = buildPublicApiGroups([t], tree);

    // Child group's background overrides grandparent's; type is still inherited.
    expect(
      result.groups![0].groups![0].tokens![0].demoMetadata,
    ).toEqual({ type: 'background-color', background: 'dark' });
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

    // All three have distinct stable keys (--old-a, --old-a-dup, --old-b).
    expect(target.tokens).toHaveLength(3);
    expect(target.tokens!.map((t) => t.deprecatedCustomProperties)).toEqual([
      ['--old-a'],
      ['--old-a-dup'],
      ['--old-b'],
    ]);
  });

  it('should not deduplicate entries with the same name but different deprecatedCustomProperties', () => {
    const target: PublicApiTokens = {
      tokens: [
        { name: 'Old Token', deprecatedCustomProperties: ['--old-color'] },
      ],
    };
    const source: PublicApiTokens = {
      tokens: [
        { name: 'Old Token', deprecatedCustomProperties: ['--old-spacing'] },
      ],
    };

    mergePublicApiResults(target, source);

    // Different deprecatedCustomProperties → distinct entries, not duplicates.
    expect(target.tokens).toHaveLength(2);
    expect(target.tokens!.map((t) => t.deprecatedCustomProperties)).toEqual([
      ['--old-color'],
      ['--old-spacing'],
    ]);
  });

  it('should not deduplicate distinct obsolete-only tokens with no customProperty', () => {
    const target: PublicApiTokens = {
      tokens: [
        { name: 'Obsolete A', obsoleteCustomProperties: ['--removed-a'] },
      ],
    };
    const source: PublicApiTokens = {
      tokens: [
        { name: 'Obsolete A', obsoleteCustomProperties: ['--removed-a-dup'] },
        { name: 'Obsolete B', obsoleteCustomProperties: ['--removed-b'] },
      ],
    };

    mergePublicApiResults(target, source);

    expect(target.tokens).toHaveLength(3);
    expect(target.tokens!.map((t) => t.obsoleteCustomProperties)).toEqual([
      ['--removed-a'],
      ['--removed-a-dup'],
      ['--removed-b'],
    ]);
  });
});

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
