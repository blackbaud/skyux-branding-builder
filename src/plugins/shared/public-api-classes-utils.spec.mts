import { describe, expect, it } from 'vitest';

import type { PublicApiClass } from '../../types/public-api-class.js';
import type { PublicApiClasses } from '../../types/public-api-classes.js';

import {
  generatePublicClassesCss,
  mergePublicApiClassesResults,
  validatePublicClassesCssProperties,
} from './public-api-classes-utils.mjs';

function makeClass(
  overrides: Partial<PublicApiClass> & { className: string },
): PublicApiClass {
  return {
    name: overrides.className,
    properties: {},
    ...overrides,
  };
}

describe('generatePublicClassesCss', () => {
  it('should generate CSS for top-level classes', () => {
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
      `.sky-theme {
  .sky-theme-margin-top-xs {
    margin-top: 0.5rem;
  }

}
`,
    );
  });

  it('should include a description comment when present', () => {
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
    expect(css).toContain('/* A helpful class. */');
    expect(css).toContain('.sky-theme-foo {');
  });

  it('should generate CSS for grouped classes', () => {
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
    expect(css).toContain('/* Margin top */');
    expect(css).toContain('/* Top margins. */');
    expect(css).toContain('.sky-theme-margin-top-xs {');
  });

  it('should handle nested subgroups', () => {
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
    expect(css).toContain('/* Colors */');
    expect(css).toContain('/* Text Colors */');
    expect(css).toContain('.sky-theme-text-default {');
  });

  it('should handle empty input', () => {
    const css = generatePublicClassesCss({}, '.sky-theme');
    expect(css).toBe(`.sky-theme {
}
`);
  });

  it('should render both top-level classes and groups', () => {
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
    expect(css).toContain('.sky-theme-ungrouped {');
    expect(css).toContain('/* Colors */');
    expect(css).toContain('.sky-theme-text-default {');
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
