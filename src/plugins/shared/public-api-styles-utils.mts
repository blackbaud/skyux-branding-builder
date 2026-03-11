import { PublicApiStyle } from '../../types/public-api-style.js';
import { PublicApiStyleGroup } from '../../types/public-api-style-group.js';
import { PublicApiStyles } from '../../types/public-api-styles.js';

export function generatePublicStylesCss(
  publicApiStyles: PublicApiStyles,
  selector: string,
): string {
  const classes = collectAllStyles(publicApiStyles);
  const lines: string[] = [];

  for (const cls of classes) {
    if (!cls.className || !cls.properties) {
      continue;
    }
    lines.push(`${selector} .${cls.className} {`);
    for (const [prop, value] of Object.entries(cls.properties)) {
      lines.push(`  ${prop}: ${value};`);
    }
    lines.push('}');
  }

  lines.push('');

  return lines.join('\n');
}

export function validatePublicStylesCssProperties(
  publicApiStyles: PublicApiStyles,
  knownCssProperties: Set<string>,
  setName: string,
): void {
  const errors: string[] = [];

  for (const cls of publicApiStyles.styles ?? []) {
    checkClassCssProperties(cls, knownCssProperties, errors);
  }
  for (const group of publicApiStyles.groups ?? []) {
    walkGroupCssProperties(group, knownCssProperties, errors);
  }

  if (errors.length) {
    throw new Error(
      `Invalid CSS custom property references in "${setName}":\n${errors.join('\n')}`,
    );
  }
}

export function mergePublicApiStylesResults(
  target: PublicApiStyles,
  source: PublicApiStyles,
): void {
  if (source.styles) {
    target.styles ??= [];
    for (const cls of source.styles) {
      if (!target.styles.some((c) => stableClassKey(c) === stableClassKey(cls))) {
        target.styles.push(cls);
      }
    }
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiStyleGroupArrays(target.groups, source.groups);
  }
}

function collectAllStyles(publicApiStyles: PublicApiStyles): PublicApiStyle[] {
  const result: PublicApiStyle[] = [];

  for (const cls of publicApiStyles.styles ?? []) {
    result.push(cls);
  }
  for (const group of publicApiStyles.groups ?? []) {
    collectGroupClasses(group, result);
  }

  return result;
}

function collectGroupClasses(
  group: PublicApiStyleGroup,
  result: PublicApiStyle[],
): void {
  for (const cls of group.styles ?? []) {
    result.push(cls);
  }
  for (const subgroup of group.groups ?? []) {
    collectGroupClasses(subgroup, result);
  }
}

function mergePublicApiStyleGroupArrays(
  target: PublicApiStyleGroup[],
  source: PublicApiStyleGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.name === srcGroup.name);
    if (existing) {
      if (srcGroup.description && !existing.description) {
        existing.description = srcGroup.description;
      }
      if (srcGroup.styles) {
        existing.styles ??= [];
        for (const cls of srcGroup.styles) {
          if (
            !existing.styles.some((c: PublicApiStyle) => stableClassKey(c) === stableClassKey(cls))
          ) {
            existing.styles.push(cls);
          }
        }
      }
      if (srcGroup.groups) {
        existing.groups ??= [];
        mergePublicApiStyleGroupArrays(existing.groups, srcGroup.groups);
      }
    } else {
      target.push(srcGroup);
    }
  }
}

function checkClassCssProperties(
  cls: PublicApiStyle,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  if (!cls.className) {
    if (cls.properties) {
      const label = classLabel(cls);
      errors.push(
        `  ${label}: has "properties" but no "className"; CSS cannot be generated for this entry`,
      );
    }
    return;
  }
  if (!cls.properties) return;
  for (const value of Object.values(cls.properties)) {
    for (const ref of extractCustomPropertyReferences(value)) {
      if (!knownCssProperties.has(ref)) {
        errors.push(
          `  .${cls.className}: "${ref}" is not defined in publicTokens`,
        );
      }
    }
  }
}

function walkGroupCssProperties(
  group: PublicApiStyleGroup,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  for (const cls of group.styles ?? []) {
    checkClassCssProperties(cls, knownCssProperties, errors);
  }
  for (const subgroup of group.groups ?? []) {
    walkGroupCssProperties(subgroup, knownCssProperties, errors);
  }
}

function extractCustomPropertyReferences(value: string): string[] {
  return [...value.matchAll(/var\((--[^,)]+)/g)].map((m) => m[1].trim());
}

function stableClassKey(cls: PublicApiStyle): string {
  if (cls.className !== undefined) return `className:${cls.className}`;
  if (cls.deprecatedClassNames !== undefined) return `deprecatedClassNames:${[...cls.deprecatedClassNames].sort().join(',')}`;
  if (cls.htmlElement !== undefined) return `htmlElement:${cls.htmlElement}`;
  return `name:${cls.name}`;
}

function classLabel(cls: PublicApiStyle): string {
  return cls.className ?? cls.deprecatedClassNames?.join(', ') ?? cls.htmlElement ?? cls.name;
}