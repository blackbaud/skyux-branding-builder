import { PublicApiClass } from '../../types/public-api-class.js';
import { PublicApiClassGroup } from '../../types/public-api-class-group.js';
import { PublicApiClasses } from '../../types/public-api-classes.js';

function mergePublicApiClassGroupArrays(
  target: PublicApiClassGroup[],
  source: PublicApiClassGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.groupName === srcGroup.groupName);
    if (existing) {
      if (srcGroup.description && !existing.description) {
        existing.description = srcGroup.description;
      }
      if (srcGroup.classes) {
        existing.classes ??= [];
        for (const cls of srcGroup.classes) {
          if (!existing.classes.some((c: PublicApiClass) => c.cssClass === cls.cssClass)) {
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

export function mergePublicApiClassesResults(
  target: PublicApiClasses,
  source: PublicApiClasses,
): void {
  if (source.classes) {
    target.classes ??= [];
    for (const cls of source.classes) {
      if (!target.classes.some((c) => c.cssClass === cls.cssClass)) {
        target.classes.push(cls);
      }
    }
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiClassGroupArrays(target.groups, source.groups);
  }
}

export function generatePublicClassGroupCss(
  group: PublicApiClassGroup,
  indent: string,
): string {
  const lines: string[] = [];

  lines.push(`${indent}/* ${group.groupName} */`);
  if (group.description) {
    lines.push(`${indent}/* ${group.description} */`);
  }
  lines.push('');

  if (group.classes) {
    for (const cls of group.classes) {
      if (cls.description) {
        lines.push(`${indent}/* ${cls.description} */`);
      }
      lines.push(`${indent}.${cls.cssClass} {`);
      if (cls.cssProperties) {
        for (const [prop, value] of Object.entries(cls.cssProperties)) {
          lines.push(`${indent}  ${prop}: ${value};`);
        }
      }
      lines.push(`${indent}}`);
      lines.push('');
    }
  }

  if (group.groups) {
    for (const subgroup of group.groups) {
      lines.push(generatePublicClassGroupCss(subgroup, indent));
    }
  }

  return lines.join('\n');
}

export function generatePublicClassesCss(
  publicApiClasses: PublicApiClasses,
  selector: string,
): string {
  const lines: string[] = [];
  const indent = '  ';

  lines.push(`${selector} {`);

  if (publicApiClasses.classes) {
    for (const cls of publicApiClasses.classes) {
      if (cls.description) {
        lines.push(`${indent}/* ${cls.description} */`);
      }
      lines.push(`${indent}.${cls.cssClass} {`);
      if (cls.cssProperties) {
        for (const [prop, value] of Object.entries(cls.cssProperties)) {
          lines.push(`${indent}  ${prop}: ${value};`);
        }
      }
      lines.push(`${indent}}`);
      lines.push('');
    }
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

export function extractVarReferences(value: string): string[] {
  return [...value.matchAll(/var\((--[^,)]+)/g)].map((m) => m[1].trim());
}

export function validatePublicClassesCssProperties(
  publicApiClasses: PublicApiClasses,
  knownCssProperties: Set<string>,
  setName: string,
): void {
  const errors: string[] = [];

  function checkClass(cssClass: string, cssProperties: Record<string, string> | undefined): void {
    if (!cssProperties) return;
    for (const value of Object.values(cssProperties)) {
      for (const ref of extractVarReferences(value)) {
        if (!knownCssProperties.has(ref)) {
          errors.push(`  .${cssClass}: "${ref}" is not defined in publicTokens`);
        }
      }
    }
  }

  function walkGroup(group: PublicApiClassGroup): void {
    for (const cls of group.classes ?? []) {
      checkClass(cls.cssClass, cls.cssProperties);
    }
    for (const subgroup of group.groups ?? []) {
      walkGroup(subgroup);
    }
  }

  for (const cls of publicApiClasses.classes ?? []) {
    checkClass(cls.cssClass, cls.cssProperties);
  }
  for (const group of publicApiClasses.groups ?? []) {
    walkGroup(group);
  }

  if (errors.length) {
    throw new Error(
      `Invalid CSS custom property references in "${setName}":\n${errors.join('\n')}`,
    );
  }
}
