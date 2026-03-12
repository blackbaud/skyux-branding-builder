import { describe, expect, it } from 'vitest';

import type { PublicApiStyle } from '../../types/public-api-style.js';
import type { PublicApiStyles } from '../../types/public-api-styles.js';

import {
  generatePublicStylesCss,
  mergePublicApiStylesResults,
  validatePublicStylesCssProperties,
} from './public-api-styles-utils.mjs';

function makeStyle(
  overrides: Partial<PublicApiStyle> & { name?: string },
): PublicApiStyle {
  return {
    name: overrides.name ?? overrides.className ?? '',
    ...overrides,
  };
}

describe('generatePublicStylesCss', () => {
  it('should generate flat CSS for top-level classes', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).toBe(
      `.sky-theme .sky-theme-margin-top-xs {
  margin-top: 0.5rem;
}
`,
    );
  });

  it('should not include description comments', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-foo',
          description: 'A helpful class.',
          properties: { display: 'block' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).not.toContain('/*');
    expect(css).toContain('.sky-theme .sky-theme-foo {');
  });

  it('should generate flat CSS for grouped classes', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Margin top',
          description: 'Top margins.',
          styles: [
            makeStyle({
              className: 'sky-theme-margin-top-xs',
              properties: { 'margin-top': '0.5rem' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).not.toContain('Margin top');
    expect(css).not.toContain('Top margins');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should flatten nested subgroups', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text Colors',
              styles: [
                makeStyle({
                  className: 'sky-theme-text-default',
                  properties: { color: 'black' },
                }),
              ],
            },
          ],
        },
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).not.toContain('/*');
    expect(css).toContain('.sky-theme .sky-theme-text-default {');
  });

  it('should handle empty input', () => {
    const css = generatePublicStylesCss({}, '.sky-theme');
    expect(css).toBe('');
  });

  it('should skip deprecated-only classes that have no className or properties', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Old Class',
          deprecatedClassNames: ['sky-old-class'],
        }),
        makeStyle({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).not.toContain('Old Class');
    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should skip obsolete-only classes that have no className or properties', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Removed Class',
          obsoleteClassNames: ['sky-removed-class'],
        }),
        makeStyle({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).not.toContain('Removed Class');
    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should skip deprecated-only classes in groups', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Spacing',
          styles: [
            makeStyle({ name: 'Old Spacing', deprecatedClassNames: ['sky-old-spacing'] }),
            makeStyle({
              className: 'sky-theme-margin-top-xs',
              properties: { 'margin-top': '0.5rem' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should skip selectors-only entries when no properties present', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Button', selectors: ['button'] }),
        makeStyle({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).not.toContain('button');
    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should generate CSS for both className and selectors when both are present', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-text-default',
          selectors: ['p'],
          properties: { color: 'black' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).toContain('.sky-theme .sky-theme-text-default {');
    expect(css).toContain('.sky-theme p {');
  });

  it('should generate CSS for each selector in the selectors list', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Base Headings',
          selectors: ['h1', 'h2', 'h3'],
          properties: { 'font-weight': 'bold' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).toContain('.sky-theme h1 {');
    expect(css).toContain('.sky-theme h2 {');
    expect(css).toContain('.sky-theme h3 {');
  });

  it('should render both top-level classes and group classes', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-ungrouped',
          properties: { display: 'block' },
        }),
      ],
      groups: [
        {
          name: 'Colors',
          styles: [
            makeStyle({
              className: 'sky-theme-text-default',
              properties: { color: 'black' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).toContain('.sky-theme .sky-theme-ungrouped {');
    expect(css).toContain('.sky-theme .sky-theme-text-default {');
    expect(css).not.toContain('/*');
  });

  it('should generate multiple class blocks with the parent selector', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-a',
          properties: { display: 'block' },
        }),
        makeStyle({
          className: 'sky-theme-b',
          properties: { display: 'flex' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');
    expect(css).toBe(
      `.sky-theme .sky-theme-a {
  display: block;
}
.sky-theme .sky-theme-b {
  display: flex;
}
`,
    );
  });
});

describe('validatePublicStylesCssProperties', () => {
  const knownProps = new Set([
    '--sky-theme-color-text-default',
    '--sky-theme-color-background-danger',
  ]);

  it('should not throw when all references are known', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-text-default',
          properties: { color: 'var(--sky-theme-color-text-default)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should throw for unknown custom property references', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-text-missing',
          properties: { color: 'var(--sky-theme-color-nonexistent)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--sky-theme-color-nonexistent');
  });

  it('should include the set name in the error message', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-bad',
          properties: { color: 'var(--nope)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'my-set'),
    ).toThrow('"my-set"');
  });

  it('should validate references inside groups', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          styles: [
            makeStyle({
              className: 'sky-theme-bad',
              properties: { color: 'var(--unknown-prop)' },
            }),
          ],
        },
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--unknown-prop');
  });

  it('should validate references in nested subgroups', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Outer',
          groups: [
            {
              name: 'Inner',
              styles: [
                makeStyle({
                  className: 'sky-theme-nested-bad',
                  properties: { color: 'var(--deeply-unknown)' },
                }),
              ],
            },
          ],
        },
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--deeply-unknown');
  });

  it('should not throw for literal values without var()', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-static',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should report multiple errors at once', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          className: 'sky-theme-a',
          properties: { color: 'var(--missing-1)' },
        }),
        makeStyle({
          className: 'sky-theme-b',
          properties: { color: 'var(--missing-2)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow(/--missing-1[\s\S]*--missing-2/);
  });

  it('should use deprecatedClassNames as the label when className is absent', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Old Class',
          deprecatedClassNames: ['sky-old-class'],
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('sky-old-class: has "properties" but no "className"');
  });

  it('should validate var() references for selectors entries', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Paragraph',
          selectors: ['p'],
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('p: "--unknown-prop" is not defined in publicTokens');
  });

  it('should use obsoleteClassNames as the label when className and deprecatedClassNames are absent', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Removed Class',
          obsoleteClassNames: ['sky-removed-class'],
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('sky-removed-class: has "properties" but no "className"');
  });

  it('should not throw for docs-only entries with no properties', () => {
    const input: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Old Class', deprecatedClassNames: ['sky-old-class'], obsoleteClassNames: ['sky-removed-class'] }),
        makeStyle({ name: 'Button', selectors: ['button'] }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should not validate var() references for entries without a className', () => {
    // Even if properties somehow exist, the error should be about missing className,
    // not about unknown var() refs — ensuring the ref validator is not invoked.
    const input: PublicApiStyles = {
      styles: [
        makeStyle({
          name: 'Old Class',
          deprecatedClassNames: ['sky-old-class'],
          properties: { color: 'var(--sky-theme-color-text-default)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('has "properties" but no "className"');

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow('is not defined in publicTokens');
  });
});

describe('mergePublicApiStylesResults', () => {
  it('should merge top-level classes without duplicates', () => {
    const target: PublicApiStyles = {
      styles: [
        makeStyle({ className: 'sky-theme-a', properties: { display: 'block' } }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        makeStyle({ className: 'sky-theme-a', properties: { display: 'none' } }),
        makeStyle({ className: 'sky-theme-b', properties: { display: 'flex' } }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.styles).toHaveLength(2);
    expect(target.styles![0].properties).toEqual({ display: 'block' });
    expect(target.styles![1].className).toBe('sky-theme-b');
  });

  it('should merge groups by name', () => {
    const target: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          styles: [
            makeStyle({
              className: 'sky-theme-text-default',
              properties: { color: 'black' },
            }),
          ],
        },
      ],
    };
    const source: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          styles: [
            makeStyle({
              className: 'sky-theme-text-default',
              properties: { color: 'white' },
            }),
            makeStyle({
              className: 'sky-theme-text-secondary',
              properties: { color: 'gray' },
            }),
          ],
        },
      ],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.groups).toHaveLength(1);
    expect(target.groups![0].styles).toHaveLength(2);
    expect(target.groups![0].styles![0].properties).toEqual({ color: 'black' });
  });

  it('should add new groups from source', () => {
    const target: PublicApiStyles = {
      groups: [{ name: 'Colors' }],
    };
    const source: PublicApiStyles = {
      groups: [{ name: 'Spacing' }],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.groups).toHaveLength(2);
    expect(target.groups!.map((g) => g.name)).toEqual(['Colors', 'Spacing']);
  });

  it('should fill in description when target group has none', () => {
    const target: PublicApiStyles = {
      groups: [{ name: 'Colors' }],
    };
    const source: PublicApiStyles = {
      groups: [{ name: 'Colors', description: 'All colors.' }],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.groups![0].description).toBe('All colors.');
  });

  it('should not overwrite existing description', () => {
    const target: PublicApiStyles = {
      groups: [{ name: 'Colors', description: 'Original.' }],
    };
    const source: PublicApiStyles = {
      groups: [{ name: 'Colors', description: 'Replacement.' }],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.groups![0].description).toBe('Original.');
  });

  it('should initialize target arrays when missing', () => {
    const target: PublicApiStyles = {};
    const source: PublicApiStyles = {
      styles: [makeStyle({ className: 'sky-theme-x', properties: {} })],
      groups: [{ name: 'G' }],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.styles).toHaveLength(1);
    expect(target.groups).toHaveLength(1);
  });

  it('should not deduplicate distinct deprecated-only classes with no className', () => {
    const target: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Deprecated A', deprecatedClassNames: ['sky-old-a'] }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        // Different deprecatedClassNames → distinct stable key despite same name as above.
        makeStyle({ name: 'Deprecated A', deprecatedClassNames: ['sky-old-a-dup'] }),
        makeStyle({ name: 'Deprecated B', deprecatedClassNames: ['sky-old-b'] }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    // All three have distinct stable keys (sky-old-a, sky-old-a-dup, sky-old-b).
    expect(target.styles).toHaveLength(3);
    expect(target.styles!.map((c) => c.deprecatedClassNames![0])).toEqual([
      'sky-old-a',
      'sky-old-a-dup',
      'sky-old-b',
    ]);
  });

  it('should not deduplicate entries with the same name but different deprecatedClassNames', () => {
    const target: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Old Style', deprecatedClassNames: ['sky-old-color'] }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Old Style', deprecatedClassNames: ['sky-old-spacing'] }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    // Different deprecatedClassNames → distinct entries, not duplicates.
    expect(target.styles).toHaveLength(2);
    expect(target.styles!.map((c) => c.deprecatedClassNames![0])).toEqual([
      'sky-old-color',
      'sky-old-spacing',
    ]);
  });

  it('should not deduplicate distinct obsolete-only classes with no className', () => {
    const target: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Obsolete A', obsoleteClassNames: ['sky-removed-a'] }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        makeStyle({ name: 'Obsolete A', obsoleteClassNames: ['sky-removed-a-dup'] }),
        makeStyle({ name: 'Obsolete B', obsoleteClassNames: ['sky-removed-b'] }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.styles).toHaveLength(3);
    expect(target.styles!.map((c) => c.obsoleteClassNames)).toEqual([
      ['sky-removed-a'],
      ['sky-removed-a-dup'],
      ['sky-removed-b'],
    ]);
  });


  it('should not deduplicate entries with the same name but different selectors', () => {
    const target: PublicApiStyles = {
      styles: [makeStyle({ name: 'Element Docs', selectors: ['button'] })],
    };
    const source: PublicApiStyles = {
      styles: [makeStyle({ name: 'Element Docs', selectors: ['a'] })],
    };

    mergePublicApiStylesResults(target, source);

    // Different selectors → distinct entries, not duplicates.
    expect(target.styles).toHaveLength(2);
    expect(target.styles!.map((c) => c.selectors)).toEqual([['button'], ['a']]);
  });

  it('should not deduplicate className entry and selectors entry sharing the same value', () => {
    const target: PublicApiStyles = {
      styles: [makeStyle({ className: 'button', properties: { display: 'inline' } })],
    };
    const source: PublicApiStyles = {
      styles: [makeStyle({ name: 'Button element', selectors: ['button'] })],
    };

    mergePublicApiStylesResults(target, source);

    // 'button' as className and 'button' in selectors are different kinds — both survive.
    expect(target.styles).toHaveLength(2);
    expect(target.styles![0].className).toBe('button');
    expect(target.styles![1].selectors).toEqual(['button']);
  });

  it('should merge nested subgroups recursively', () => {
    const target: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text',
              styles: [
                makeStyle({ className: 'sky-theme-text-a', properties: {} }),
              ],
            },
          ],
        },
      ],
    };
    const source: PublicApiStyles = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text',
              styles: [
                makeStyle({ className: 'sky-theme-text-b', properties: {} }),
              ],
            },
          ],
        },
      ],
    };

    mergePublicApiStylesResults(target, source);

    const textGroup = target.groups![0].groups![0];
    expect(textGroup.styles).toHaveLength(2);
  });

  it('should exclude top-level styles flagged with excludeFromDocs', () => {
    const target: PublicApiStyles = {};
    const source: PublicApiStyles = {
      styles: [
        makeStyle({ className: 'sky-theme-visible', properties: { display: 'block' } }),
        makeStyle({ className: 'sky-theme-hidden', properties: { display: 'none' }, excludeFromDocs: true }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.styles).toHaveLength(1);
    expect(target.styles![0].className).toBe('sky-theme-visible');
  });

  it('should exclude styles inside groups flagged with excludeFromDocs', () => {
    const target: PublicApiStyles = {};
    const source: PublicApiStyles = {
      groups: [
        {
          name: 'Spacing',
          styles: [
            makeStyle({ className: 'sky-theme-xs', properties: { 'margin-top': '0.5rem' } }),
            makeStyle({ className: 'sky-theme-internal', properties: { 'margin-top': '1rem' }, excludeFromDocs: true }),
          ],
        },
      ],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.groups![0].styles).toHaveLength(1);
    expect(target.groups![0].styles![0].className).toBe('sky-theme-xs');
  });
});
