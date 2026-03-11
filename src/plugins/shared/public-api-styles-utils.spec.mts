import { describe, expect, it } from 'vitest';

import type { PublicApiStyle } from '../../types/public-api-style.js';
import type { PublicApiStyles } from '../../types/public-api-styles.js';

import {
  generatePublicStylesCss,
  mergePublicApiStylesResults,
  validatePublicStylesCssProperties,
} from './public-api-styles-utils.mjs';

function makeClass(
  overrides: Partial<PublicApiStyle> & { name?: string },
): PublicApiStyle {
  return {
    name: overrides.name ?? overrides.className ?? '',
    ...overrides,
  };
}

describe('generatePublicClassesCss', () => {
  it('should generate flat CSS for top-level classes', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
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
        makeClass({
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
            makeClass({
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
                makeClass({
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
        makeClass({
          name: 'Old Class',
          deprecatedClassName: 'sky-old-class',
        }),
        makeClass({
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

  it('should skip deprecated-only classes in groups', () => {
    const input: PublicApiStyles = {
      groups: [
        {
          name: 'Spacing',
          styles: [
            makeClass({ name: 'Old Spacing', deprecatedClassName: 'sky-old-spacing' }),
            makeClass({
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

  it('should skip htmlElement-only classes (no className or properties)', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({ name: 'Button', htmlElement: 'button' }),
        makeClass({
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

  it('should generate CSS only for the className when both className and htmlElement are present', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
          className: 'sky-theme-text-default',
          htmlElement: 'p',
          properties: { color: 'black' },
        }),
      ],
    };

    const css = generatePublicStylesCss(input, '.sky-theme');

    expect(css).toContain('.sky-theme .sky-theme-text-default {');
    expect(css).not.toContain('.sky-theme p {');
  });

  it('should render both top-level classes and group classes', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
          className: 'sky-theme-ungrouped',
          properties: { display: 'block' },
        }),
      ],
      groups: [
        {
          name: 'Colors',
          styles: [
            makeClass({
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
        makeClass({
          className: 'sky-theme-a',
          properties: { display: 'block' },
        }),
        makeClass({
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

describe('validatePublicClassesCssProperties', () => {
  const knownProps = new Set([
    '--sky-theme-color-text-default',
    '--sky-theme-color-background-danger',
  ]);

  it('should not throw when all references are known', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
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
        makeClass({
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
        makeClass({
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
            makeClass({
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
                makeClass({
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
        makeClass({
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
        makeClass({
          className: 'sky-theme-a',
          properties: { color: 'var(--missing-1)' },
        }),
        makeClass({
          className: 'sky-theme-b',
          properties: { color: 'var(--missing-2)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow(/--missing-1[\s\S]*--missing-2/);
  });

  it('should use deprecatedClassName as the label when className is absent', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
          name: 'Old Class',
          deprecatedClassName: 'sky-old-class',
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('sky-old-class: has "properties" but no "className"');
  });

  it('should use htmlElement as the label when className and deprecatedClassName are absent', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({
          name: 'Paragraph',
          htmlElement: 'p',
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicStylesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('p: has "properties" but no "className"');
  });

  it('should not throw for docs-only entries with no className and no properties', () => {
    const input: PublicApiStyles = {
      styles: [
        makeClass({ name: 'Old Class', deprecatedClassName: 'sky-old-class' }),
        makeClass({ name: 'Button', htmlElement: 'button' }),
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
        makeClass({
          name: 'Old Class',
          deprecatedClassName: 'sky-old-class',
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
        makeClass({ className: 'sky-theme-a', properties: { display: 'block' } }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        makeClass({ className: 'sky-theme-a', properties: { display: 'none' } }),
        makeClass({ className: 'sky-theme-b', properties: { display: 'flex' } }),
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
            makeClass({
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
            makeClass({
              className: 'sky-theme-text-default',
              properties: { color: 'white' },
            }),
            makeClass({
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
      styles: [makeClass({ className: 'sky-theme-x', properties: {} })],
      groups: [{ name: 'G' }],
    };

    mergePublicApiStylesResults(target, source);

    expect(target.styles).toHaveLength(1);
    expect(target.groups).toHaveLength(1);
  });

  it('should not deduplicate distinct deprecated-only classes with no className', () => {
    const target: PublicApiStyles = {
      styles: [
        makeClass({ name: 'Deprecated A', deprecatedClassName: 'sky-old-a' }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        // Different deprecatedClassName → distinct stable key despite same name as above.
        makeClass({ name: 'Deprecated A', deprecatedClassName: 'sky-old-a-dup' }),
        makeClass({ name: 'Deprecated B', deprecatedClassName: 'sky-old-b' }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    // All three have distinct stable keys (sky-old-a, sky-old-a-dup, sky-old-b).
    expect(target.styles).toHaveLength(3);
    expect(target.styles!.map((c) => c.deprecatedClassName)).toEqual([
      'sky-old-a',
      'sky-old-a-dup',
      'sky-old-b',
    ]);
  });

  it('should not deduplicate entries with the same name but different deprecatedClassName', () => {
    const target: PublicApiStyles = {
      styles: [
        makeClass({ name: 'Old Style', deprecatedClassName: 'sky-old-color' }),
      ],
    };
    const source: PublicApiStyles = {
      styles: [
        makeClass({ name: 'Old Style', deprecatedClassName: 'sky-old-spacing' }),
      ],
    };

    mergePublicApiStylesResults(target, source);

    // Different deprecatedClassName → distinct entries, not duplicates.
    expect(target.styles).toHaveLength(2);
    expect(target.styles!.map((c) => c.deprecatedClassName)).toEqual([
      'sky-old-color',
      'sky-old-spacing',
    ]);
  });

  it('should not deduplicate entries with the same name but different htmlElement', () => {
    const target: PublicApiStyles = {
      styles: [makeClass({ name: 'Element Docs', htmlElement: 'button' })],
    };
    const source: PublicApiStyles = {
      styles: [makeClass({ name: 'Element Docs', htmlElement: 'a' })],
    };

    mergePublicApiStylesResults(target, source);

    // Different htmlElement → distinct entries, not duplicates.
    expect(target.styles).toHaveLength(2);
    expect(target.styles!.map((c) => c.htmlElement)).toEqual(['button', 'a']);
  });

  it('should not deduplicate className entry and htmlElement entry sharing the same value', () => {
    const target: PublicApiStyles = {
      styles: [makeClass({ className: 'button', properties: { display: 'inline' } })],
    };
    const source: PublicApiStyles = {
      styles: [makeClass({ name: 'Button element', htmlElement: 'button' })],
    };

    mergePublicApiStylesResults(target, source);

    // 'button' as className and 'button' as htmlElement are different kinds — both survive.
    expect(target.styles).toHaveLength(2);
    expect(target.styles![0].className).toBe('button');
    expect(target.styles![1].htmlElement).toBe('button');
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
                makeClass({ className: 'sky-theme-text-a', properties: {} }),
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
                makeClass({ className: 'sky-theme-text-b', properties: {} }),
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
});
