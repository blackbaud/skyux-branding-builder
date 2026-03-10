import { describe, expect, it } from 'vitest';

import type { PublicApiClass } from '../../types/public-api-class.js';
import type { PublicApiClasses } from '../../types/public-api-classes.js';

import {
  generatePublicClassesCss,
  mergePublicApiClassesResults,
  validatePublicClassesCssProperties,
} from './public-api-classes-utils.mjs';

function makeClass(
  overrides: Partial<PublicApiClass> & { name?: string },
): PublicApiClass {
  return {
    name: overrides.name ?? overrides.className ?? '',
    ...overrides,
  };
}

describe('generatePublicClassesCss', () => {
  it('should generate flat CSS for top-level classes', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');
    expect(css).toBe(
      `.sky-theme .sky-theme-margin-top-xs {
  margin-top: 0.5rem;
}
`,
    );
  });

  it('should not include description comments', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-foo',
          description: 'A helpful class.',
          properties: { display: 'block' },
        }),
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');
    expect(css).not.toContain('/*');
    expect(css).toContain('.sky-theme .sky-theme-foo {');
  });

  it('should generate flat CSS for grouped classes', () => {
    const input: PublicApiClasses = {
      groups: [
        {
          name: 'Margin top',
          description: 'Top margins.',
          classes: [
            makeClass({
              className: 'sky-theme-margin-top-xs',
              properties: { 'margin-top': '0.5rem' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');
    expect(css).not.toContain('Margin top');
    expect(css).not.toContain('Top margins');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should flatten nested subgroups', () => {
    const input: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text Colors',
              classes: [
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

    const css = generatePublicClassesCss(input, '.sky-theme');
    expect(css).not.toContain('/*');
    expect(css).toContain('.sky-theme .sky-theme-text-default {');
  });

  it('should handle empty input', () => {
    const css = generatePublicClassesCss({}, '.sky-theme');
    expect(css).toBe('');
  });

  it('should skip deprecated-only classes that have no className or properties', () => {
    const input: PublicApiClasses = {
      classes: [
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

    const css = generatePublicClassesCss(input, '.sky-theme');

    expect(css).not.toContain('Old Class');
    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should skip deprecated-only classes in groups', () => {
    const input: PublicApiClasses = {
      groups: [
        {
          name: 'Spacing',
          classes: [
            makeClass({ name: 'Old Spacing', deprecatedClassName: 'sky-old-spacing' }),
            makeClass({
              className: 'sky-theme-margin-top-xs',
              properties: { 'margin-top': '0.5rem' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');

    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should skip htmlElement-only classes (no className or properties)', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({ name: 'Button', htmlElement: 'button' }),
        makeClass({
          className: 'sky-theme-margin-top-xs',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');

    expect(css).not.toContain('button');
    expect(css).not.toContain('undefined');
    expect(css).toContain('.sky-theme .sky-theme-margin-top-xs {');
  });

  it('should generate CSS only for the className when both className and htmlElement are present', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-text-default',
          htmlElement: 'p',
          properties: { color: 'black' },
        }),
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');

    expect(css).toContain('.sky-theme .sky-theme-text-default {');
    expect(css).not.toContain('.sky-theme p {');
  });

  it('should render both top-level classes and group classes', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-ungrouped',
          properties: { display: 'block' },
        }),
      ],
      groups: [
        {
          name: 'Colors',
          classes: [
            makeClass({
              className: 'sky-theme-text-default',
              properties: { color: 'black' },
            }),
          ],
        },
      ],
    };

    const css = generatePublicClassesCss(input, '.sky-theme');
    expect(css).toContain('.sky-theme .sky-theme-ungrouped {');
    expect(css).toContain('.sky-theme .sky-theme-text-default {');
    expect(css).not.toContain('/*');
  });

  it('should generate multiple class blocks with the parent selector', () => {
    const input: PublicApiClasses = {
      classes: [
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

    const css = generatePublicClassesCss(input, '.sky-theme');
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
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-text-default',
          properties: { color: 'var(--sky-theme-color-text-default)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should throw for unknown custom property references', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-text-missing',
          properties: { color: 'var(--sky-theme-color-nonexistent)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--sky-theme-color-nonexistent');
  });

  it('should include the set name in the error message', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-bad',
          properties: { color: 'var(--nope)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'my-set'),
    ).toThrow('"my-set"');
  });

  it('should validate references inside groups', () => {
    const input: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          classes: [
            makeClass({
              className: 'sky-theme-bad',
              properties: { color: 'var(--unknown-prop)' },
            }),
          ],
        },
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--unknown-prop');
  });

  it('should validate references in nested subgroups', () => {
    const input: PublicApiClasses = {
      groups: [
        {
          name: 'Outer',
          groups: [
            {
              name: 'Inner',
              classes: [
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
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('--deeply-unknown');
  });

  it('should not throw for literal values without var()', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          className: 'sky-theme-static',
          properties: { 'margin-top': '0.5rem' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should report multiple errors at once', () => {
    const input: PublicApiClasses = {
      classes: [
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
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow(/--missing-1[\s\S]*--missing-2/);
  });

  it('should use deprecatedClassName as the label when className is absent', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          name: 'Old Class',
          deprecatedClassName: 'sky-old-class',
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('sky-old-class: has "properties" but no "className"');
  });

  it('should use htmlElement as the label when className and deprecatedClassName are absent', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          name: 'Paragraph',
          htmlElement: 'p',
          properties: { color: 'var(--unknown-prop)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('p: has "properties" but no "className"');
  });

  it('should not throw for docs-only entries with no className and no properties', () => {
    const input: PublicApiClasses = {
      classes: [
        makeClass({ name: 'Old Class', deprecatedClassName: 'sky-old-class' }),
        makeClass({ name: 'Button', htmlElement: 'button' }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow();
  });

  it('should not validate var() references for entries without a className', () => {
    // Even if properties somehow exist, the error should be about missing className,
    // not about unknown var() refs — ensuring the ref validator is not invoked.
    const input: PublicApiClasses = {
      classes: [
        makeClass({
          name: 'Old Class',
          deprecatedClassName: 'sky-old-class',
          properties: { color: 'var(--sky-theme-color-text-default)' },
        }),
      ],
    };

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).toThrow('has "properties" but no "className"');

    expect(() =>
      validatePublicClassesCssProperties(input, knownProps, 'test-set'),
    ).not.toThrow('is not defined in publicTokens');
  });
});

describe('mergePublicApiClassesResults', () => {
  it('should merge top-level classes without duplicates', () => {
    const target: PublicApiClasses = {
      classes: [
        makeClass({ className: 'sky-theme-a', properties: { display: 'block' } }),
      ],
    };
    const source: PublicApiClasses = {
      classes: [
        makeClass({ className: 'sky-theme-a', properties: { display: 'none' } }),
        makeClass({ className: 'sky-theme-b', properties: { display: 'flex' } }),
      ],
    };

    mergePublicApiClassesResults(target, source);

    expect(target.classes).toHaveLength(2);
    expect(target.classes![0].properties).toEqual({ display: 'block' });
    expect(target.classes![1].className).toBe('sky-theme-b');
  });

  it('should merge groups by name', () => {
    const target: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          classes: [
            makeClass({
              className: 'sky-theme-text-default',
              properties: { color: 'black' },
            }),
          ],
        },
      ],
    };
    const source: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          classes: [
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

    mergePublicApiClassesResults(target, source);

    expect(target.groups).toHaveLength(1);
    expect(target.groups![0].classes).toHaveLength(2);
    expect(target.groups![0].classes![0].properties).toEqual({ color: 'black' });
  });

  it('should add new groups from source', () => {
    const target: PublicApiClasses = {
      groups: [{ name: 'Colors' }],
    };
    const source: PublicApiClasses = {
      groups: [{ name: 'Spacing' }],
    };

    mergePublicApiClassesResults(target, source);

    expect(target.groups).toHaveLength(2);
    expect(target.groups!.map((g) => g.name)).toEqual(['Colors', 'Spacing']);
  });

  it('should fill in description when target group has none', () => {
    const target: PublicApiClasses = {
      groups: [{ name: 'Colors' }],
    };
    const source: PublicApiClasses = {
      groups: [{ name: 'Colors', description: 'All colors.' }],
    };

    mergePublicApiClassesResults(target, source);

    expect(target.groups![0].description).toBe('All colors.');
  });

  it('should not overwrite existing description', () => {
    const target: PublicApiClasses = {
      groups: [{ name: 'Colors', description: 'Original.' }],
    };
    const source: PublicApiClasses = {
      groups: [{ name: 'Colors', description: 'Replacement.' }],
    };

    mergePublicApiClassesResults(target, source);

    expect(target.groups![0].description).toBe('Original.');
  });

  it('should initialize target arrays when missing', () => {
    const target: PublicApiClasses = {};
    const source: PublicApiClasses = {
      classes: [makeClass({ className: 'sky-theme-x', properties: {} })],
      groups: [{ name: 'G' }],
    };

    mergePublicApiClassesResults(target, source);

    expect(target.classes).toHaveLength(1);
    expect(target.groups).toHaveLength(1);
  });

  it('should not deduplicate distinct deprecated-only classes with no className', () => {
    const target: PublicApiClasses = {
      classes: [
        makeClass({ name: 'Deprecated A', deprecatedClassName: 'sky-old-a' }),
      ],
    };
    const source: PublicApiClasses = {
      classes: [
        // Different deprecatedClassName → distinct stable key despite same name as above.
        makeClass({ name: 'Deprecated A', deprecatedClassName: 'sky-old-a-dup' }),
        makeClass({ name: 'Deprecated B', deprecatedClassName: 'sky-old-b' }),
      ],
    };

    mergePublicApiClassesResults(target, source);

    // All three have distinct stable keys (sky-old-a, sky-old-a-dup, sky-old-b).
    expect(target.classes).toHaveLength(3);
    expect(target.classes!.map((c) => c.deprecatedClassName)).toEqual([
      'sky-old-a',
      'sky-old-a-dup',
      'sky-old-b',
    ]);
  });

  it('should not deduplicate entries with the same name but different deprecatedClassName', () => {
    const target: PublicApiClasses = {
      classes: [
        makeClass({ name: 'Old Style', deprecatedClassName: 'sky-old-color' }),
      ],
    };
    const source: PublicApiClasses = {
      classes: [
        makeClass({ name: 'Old Style', deprecatedClassName: 'sky-old-spacing' }),
      ],
    };

    mergePublicApiClassesResults(target, source);

    // Different deprecatedClassName → distinct entries, not duplicates.
    expect(target.classes).toHaveLength(2);
    expect(target.classes!.map((c) => c.deprecatedClassName)).toEqual([
      'sky-old-color',
      'sky-old-spacing',
    ]);
  });

  it('should not deduplicate entries with the same name but different htmlElement', () => {
    const target: PublicApiClasses = {
      classes: [makeClass({ name: 'Element Docs', htmlElement: 'button' })],
    };
    const source: PublicApiClasses = {
      classes: [makeClass({ name: 'Element Docs', htmlElement: 'a' })],
    };

    mergePublicApiClassesResults(target, source);

    // Different htmlElement → distinct entries, not duplicates.
    expect(target.classes).toHaveLength(2);
    expect(target.classes!.map((c) => c.htmlElement)).toEqual(['button', 'a']);
  });

  it('should not deduplicate className entry and htmlElement entry sharing the same value', () => {
    const target: PublicApiClasses = {
      classes: [makeClass({ className: 'button', properties: { display: 'inline' } })],
    };
    const source: PublicApiClasses = {
      classes: [makeClass({ name: 'Button element', htmlElement: 'button' })],
    };

    mergePublicApiClassesResults(target, source);

    // 'button' as className and 'button' as htmlElement are different kinds — both survive.
    expect(target.classes).toHaveLength(2);
    expect(target.classes![0].className).toBe('button');
    expect(target.classes![1].htmlElement).toBe('button');
  });

  it('should merge nested subgroups recursively', () => {
    const target: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text',
              classes: [
                makeClass({ className: 'sky-theme-text-a', properties: {} }),
              ],
            },
          ],
        },
      ],
    };
    const source: PublicApiClasses = {
      groups: [
        {
          name: 'Colors',
          groups: [
            {
              name: 'Text',
              classes: [
                makeClass({ className: 'sky-theme-text-b', properties: {} }),
              ],
            },
          ],
        },
      ],
    };

    mergePublicApiClassesResults(target, source);

    const textGroup = target.groups![0].groups![0];
    expect(textGroup.classes).toHaveLength(2);
  });
});
