import { DemoMetadata } from '../../types/demo-metadata.js';
import { PublicApiStyle } from '../../types/public-api-style.js';
import { PublicApiStyleGroup } from '../../types/public-api-style-group.js';
import { PublicApiStyles } from '../../types/public-api-styles.js';

export function generatePublicStylesCss(
  publicApiStyles: PublicApiStyles,
): string {
  const styles = collectAllStyles(publicApiStyles);
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const style of styles) {
    if (style.className && style.properties) {
      const rule = buildRule(`.${style.className}`, style.properties);
      if (!seen.has(rule)) {
        seen.add(rule);
        lines.push(rule);
      }
    }
    if (style.selectors && style.selectors.length > 0 && style.properties) {
      for (const sel of style.selectors) {
        const rule = buildRule(sel, style.properties);
        if (!seen.has(rule)) {
          seen.add(rule);
          lines.push(rule);
        }
      }
    }
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

  for (const style of publicApiStyles.styles ?? []) {
    checkStyleCssProperties(style, knownCssProperties, errors);
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

export function applyStylesDemoMetadataInheritance(api: PublicApiStyles): void {
  for (const group of api.groups ?? []) {
    applyGroupDemoMetadata(group, undefined);
  }
}

export function mergePublicApiStylesResults(
  target: PublicApiStyles,
  source: PublicApiStyles,
): void {
  if (source.styles) {
    target.styles ??= [];
    mergeStyleArrays(target.styles, source.styles);
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiStyleGroupArrays(target.groups, source.groups);
  }
}

export function mergePublicApiStylesResultsForCss(
  target: PublicApiStyles,
  source: PublicApiStyles,
): void {
  if (source.styles) {
    target.styles ??= [];
    mergeStyleArrays(target.styles, source.styles, true);
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiStyleGroupArrays(target.groups, source.groups, true);
  }
}

function applyGroupDemoMetadata(
  group: PublicApiStyleGroup,
  inherited: DemoMetadata | undefined,
): void {
  const accumulated = group.demoMetadata
    ? { ...inherited, ...group.demoMetadata }
    : inherited;

  if (accumulated) {
    group.demoMetadata = accumulated;
  }

  if (group.styles && accumulated) {
    for (const style of group.styles) {
      style.demoMetadata = { ...accumulated, ...style.demoMetadata };
    }
  }

  if (group.groups) {
    for (const subgroup of group.groups) {
      applyGroupDemoMetadata(subgroup, accumulated);
    }
  }
}

function buildRule(
  selector: string,
  properties: Record<string, string>,
): string {
  const propLines = Object.entries(properties)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');
  return `${selector} {\n${propLines}\n}`;
}

function collectAllStyles(publicApiStyles: PublicApiStyles): PublicApiStyle[] {
  const result: PublicApiStyle[] = [];

  for (const style of publicApiStyles.styles ?? []) {
    result.push(style);
  }
  for (const group of publicApiStyles.groups ?? []) {
    collectGroupStyles(group, result);
  }

  return result;
}

function collectGroupStyles(
  group: PublicApiStyleGroup,
  result: PublicApiStyle[],
): void {
  for (const style of group.styles ?? []) {
    result.push(style);
  }
  for (const subgroup of group.groups ?? []) {
    collectGroupStyles(subgroup, result);
  }
}

function mergePublicApiStyleGroupArrays(
  target: PublicApiStyleGroup[],
  source: PublicApiStyleGroup[],
  includeExcluded = false,
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.name === srcGroup.name);
    if (existing) {
      if (srcGroup.description && !existing.description) {
        existing.description = srcGroup.description;
      }
      existing.imageToken ??= srcGroup.imageToken;
      existing.demoMetadata ??= srcGroup.demoMetadata;
      if (srcGroup.styles) {
        existing.styles ??= [];
        mergeStyleArrays(existing.styles, srcGroup.styles, includeExcluded);
      }
      if (srcGroup.groups) {
        existing.groups ??= [];
        mergePublicApiStyleGroupArrays(
          existing.groups,
          srcGroup.groups,
          includeExcluded,
        );
      }
    } else {
      const newGroup = { ...srcGroup };
      if (newGroup.styles) {
        const filteredStyles: PublicApiStyle[] = [];
        mergeStyleArrays(filteredStyles, newGroup.styles, includeExcluded);
        newGroup.styles = filteredStyles;
      }
      if (newGroup.groups) {
        const filteredGroups: PublicApiStyleGroup[] = [];
        mergePublicApiStyleGroupArrays(
          filteredGroups,
          newGroup.groups,
          includeExcluded,
        );
        newGroup.groups = filteredGroups;
      }
      target.push(newGroup);
    }
  }
}

function checkStyleCssProperties(
  style: PublicApiStyle,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  const hasClassName = !!style.className;
  const hasSelectors = !!(style.selectors && style.selectors.length > 0);

  if (!hasClassName && !hasSelectors) {
    if (style.properties) {
      const label = styleLabel(style);
      errors.push(
        `  ${label}: has "properties" but no "className" or "selectors"; CSS cannot be generated for this entry`,
      );
    }
    return;
  }

  if (!style.properties) {
    return;
  }
  const label = hasClassName ? `.${style.className}` : styleLabel(style);
  for (const value of Object.values(style.properties)) {
    for (const ref of extractCustomPropertyReferences(value)) {
      if (!knownCssProperties.has(ref)) {
        errors.push(`  ${label}: "${ref}" is not defined in publicTokens`);
      }
    }
  }
}

function walkGroupCssProperties(
  group: PublicApiStyleGroup,
  knownCssProperties: Set<string>,
  errors: string[],
): void {
  for (const style of group.styles ?? []) {
    checkStyleCssProperties(style, knownCssProperties, errors);
  }
  for (const subgroup of group.groups ?? []) {
    walkGroupCssProperties(subgroup, knownCssProperties, errors);
  }
}

function extractCustomPropertyReferences(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[^,)]+)/g)].map((m) => m[1].trim());
}

function stableStyleKey(style: PublicApiStyle): string {
  if (style.className !== undefined) {
    return `className:${style.className}`;
  }
  if (style.deprecatedClassNames !== undefined) {
    return `deprecatedClassNames:${[...style.deprecatedClassNames].sort().join(',')}`;
  }
  if (style.obsoleteClassNames !== undefined) {
    return `obsoleteClassNames:${[...style.obsoleteClassNames].sort().join(',')}`;
  }
  if (style.selectors !== undefined) {
    return `selectors:${[...style.selectors].sort().join(',')}`;
  }
  return `name:${style.name}`;
}

function mergeStyleArrays(
  target: PublicApiStyle[],
  source: PublicApiStyle[],
  includeExcluded = false,
): void {
  for (const style of source) {
    if (
      (includeExcluded || !style.excludeFromDocs) &&
      !target.some((c) => stableStyleKey(c) === stableStyleKey(style))
    ) {
      target.push(style);
    }
  }
}

function styleLabel(style: PublicApiStyle): string {
  return (
    style.className ??
    style.deprecatedClassNames?.join(', ') ??
    style.obsoleteClassNames?.join(', ') ??
    style.selectors?.join(', ') ??
    style.name
  );
}
