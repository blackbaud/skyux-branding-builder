import { PublicApiClass } from '../../types/public-api-class.js';
import { PublicApiClassGroup } from '../../types/public-api-class-group.js';
import { PublicApiClasses } from '../../types/public-api-classes.js';

export function generatePublicClassesCss(
  publicApiClasses: PublicApiClasses,
  selector: string,
): string {
  const lines: string[] = [];
  const indent = '  ';

  lines.push(`${selector} {`);

  for (const cls of publicApiClasses.classes ?? []) {
    lines.push(generatePublicClassCss(cls, indent));
  }

  if (publicApiClasses.groups) {
    for (const group of publicApiClasses.groups) {
      lines.push(generatePublicClassGroupCss(group, indent));
    }
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

export function validatePublicClassesCssProperties(
  publicApiClasses: PublicApiClasses,
  knownCssProperties: Set<string>,
  setName: string,
): void {
  const errors: string[] = [];

  for (const cls of publicApiClasses.classes ?? []) {
    checkClassCssProperties(cls.className, cls.properties, knownCssProperties, errors);
  }
  for (const group of publicApiClasses.groups ?? []) {
    walkGroupCssProperties(group, knownCssProperties, errors);
  }

  if (errors.length) {
    throw new Error(
      `Invalid CSS custom property references in "${setName}":\n${errors.join('\n')}`,
    );
  }
}

export function mergePublicApiClassesResults(
  target: PublicApiClasses,
  source: PublicApiClasses,
): void {
  if (source.classes) {
    target.classes ??= [];
    for (const cls of source.classes) {
      if (!target.classes.some((c) => c.className === cls.className)) {
        target.classes.push(cls);
      }
    }
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiClassGroupArrays(target.groups, source.groups);
  }
}

function generatePublicClassCss(
  cls: PublicApiClass,
  indent: string,
): string {
  const lines: string[] = [];

  if (cls.description) {
    lines.push(`${indent}/* ${cls.description} */`);
  }
  lines.push(`${indent}.${cls.className} {`);
  if (cls.properties) {
    for (const [prop, value] of Object.entries(cls.properties)) {
      lines.push(`${indent}  ${prop}: ${value};`);
    }
  }
  lines.push(`${indent}}`);
  lines.push('');

  return lines.join('\n');
}

function generatePublicClassGroupCss(
  group: PublicApiClassGroup,
  indent: string,
): string {
  const lines: string[] = [];

  lines.push(`${indent}/* ${group.name} */`);
  if (group.description) {
    lines.push(`${indent}/* ${group.description} */`);
  }

  for (const cls of group.classes ?? []) {
    lines.push(generatePublicClassCss(cls, indent));
  }

  for (const subgroup of group.groups ?? []) {
    lines.push(generatePublicClassGroupCss(subgroup, indent));
  }

  return lines.join('\n');
}

function mergePublicApiClassGroupArrays(
  target: PublicApiClassGroup[],
  source: PublicApiClassGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.name === srcGroup.name);
    if (existing) {
      if (srcGroup.description && !existing.description) {
        existing.description = srcGroup.description;
      }
      if (srcGroup.classes) {
        existing.classes ??= [];
        for (const cls of srcGroup.classes) {
          if (!existing.classes.some((c: PublicApiClass) => c.className === cls.className)) {
            existing.classes.push(cls);
          }
        }
      }
      if (srcGroup.groups) {
        existing.groups ??= [];
        mergePublicApiClassGroupArrays(existing.groups, srcGroup.groups);
      }
    } else {
      target.push(srcGroup);
    }
  }
}

function checkClassCssProperties(
  className: string,
  properties: Record<string, string> | undefined,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  if (!properties) return;
  for (const value of Object.values(properties)) {
    for (const ref of extractCustomPropertyReferences(value)) {
      if (!knownCssProperties.has(ref)) {
        errors.push(`  .${className}: "${ref}" is not defined in publicTokens`);
      }
    }
  }
}

function walkGroupCssProperties(
  group: PublicApiClassGroup,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  for (const cls of group.classes ?? []) {
    checkClassCssProperties(cls.className, cls.properties, knownCssProperties, errors);
  }
  for (const subgroup of group.groups ?? []) {
    walkGroupCssProperties(subgroup, knownCssProperties, errors);
  }
}

function extractCustomPropertyReferences(value: string): string[] {
  return [...value.matchAll(/var\((--[^,)]+)/g)].map((m) => m[1].trim());
}