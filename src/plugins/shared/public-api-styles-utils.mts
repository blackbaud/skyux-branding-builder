import { DemoMetadata } from '../../types/demo-metadata.js';
import { PublicApiStyle } from '../../types/public-api-style.js';
import { PublicApiStyleGroup } from '../../types/public-api-style-group.js';
import { PublicApiStyles } from '../../types/public-api-styles.js';

export const CONTEXT_OVERRIDE_PREFIX = '--sky-ctx-override-';

interface CustomPropertyReference {
  name: string;
  hasFallback: boolean;
}

export function generatePublicStylesCss(
  publicApiStyles: PublicApiStyles,
): string {
  const styles = collectAllStyles(publicApiStyles);
  const contextOverrideNames = [
    ...collectContextOverrideNames(publicApiStyles),
  ].sort();
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const style of styles) {
    const declarations = getStyleDeclarations(style, contextOverrideNames);
    if (!declarations) {
      continue;
    }
    if (style.className) {
      const rule = buildRule(`.${style.className}`, declarations);
      if (!seen.has(rule)) {
        seen.add(rule);
        lines.push(rule);
      }
    }
    for (const sel of style.selectors ?? []) {
      const rule = buildRule(sel, declarations);
      if (!seen.has(rule)) {
        seen.add(rule);
        lines.push(rule);
      }
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Collects the names of all context overrides declared by the given styles.
 */
export function collectContextOverrideNames(
  publicApiStyles: PublicApiStyles,
  result = new Set<string>(),
): Set<string> {
  for (const style of collectAllStyles(publicApiStyles)) {
    for (const name of Object.keys(style.contextOverrides ?? {})) {
      result.add(name);
    }
  }
  return result;
}

/**
 * Validates the custom property references in the given styles. `declaredContextOverrides`
 * holds the context overrides declared across all style sets, since a style may read an
 * override that a style in another set declares.
 */
export function validatePublicStylesCssProperties(
  publicApiStyles: PublicApiStyles,
  knownCssProperties: Set<string>,
  setName: string,
  declaredContextOverrides = new Set<string>(),
): void {
  const errors: string[] = [];

  for (const style of collectAllStyles(publicApiStyles)) {
    checkStyleCssProperties(
      style,
      knownCssProperties,
      declaredContextOverrides,
      errors,
    );
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

function getStyleDeclarations(
  style: PublicApiStyle,
  contextOverrideNames: string[],
): Record<string, string> | undefined {
  const declarations: Record<string, string> = {
    ...style.properties,
    ...style.contextOverrides,
  };

  if (style.resetContextOverrides) {
    for (const name of contextOverrideNames) {
      declarations[name] ??= 'initial';
    }
  }

  return Object.keys(declarations).length ? declarations : undefined;
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
  declaredContextOverrides: Set<string>,
  errors: string[],
): void {
  const hasClassName = !!style.className;
  const hasSelectors = !!(style.selectors && style.selectors.length > 0);

  if (!hasClassName && !hasSelectors) {
    const field = style.properties
      ? 'properties'
      : style.contextOverrides
        ? 'contextOverrides'
        : style.resetContextOverrides
          ? 'resetContextOverrides'
          : undefined;
    if (field) {
      const label = styleLabel(style);
      errors.push(
        `  ${label}: has "${field}" but no "className" or "selectors"; CSS cannot be generated for this entry`,
      );
    }
    return;
  }

  const label = hasClassName ? `.${style.className}` : styleLabel(style);

  for (const [prop, value] of Object.entries(style.properties ?? {})) {
    if (prop.startsWith(CONTEXT_OVERRIDE_PREFIX)) {
      errors.push(
        `  ${label}: "${prop}" must be set in "contextOverrides", not "properties"`,
      );
    }
    for (const ref of extractCustomPropertyReferences(value)) {
      if (!ref.name.startsWith(CONTEXT_OVERRIDE_PREFIX)) {
        if (!knownCssProperties.has(ref.name)) {
          errors.push(
            `  ${label}: "${ref.name}" is not defined in publicTokens`,
          );
        }
      } else if (!declaredContextOverrides.has(ref.name)) {
        errors.push(
          `  ${label}: "${ref.name}" is not declared in any "contextOverrides"`,
        );
      } else if (!ref.hasFallback) {
        errors.push(
          `  ${label}: "${ref.name}" must have a fallback value, since context overrides are unset outside a container`,
        );
      }
    }
  }

  for (const [prop, value] of Object.entries(style.contextOverrides ?? {})) {
    if (!prop.startsWith(CONTEXT_OVERRIDE_PREFIX)) {
      errors.push(
        `  ${label}: context override "${prop}" must start with "${CONTEXT_OVERRIDE_PREFIX}"`,
      );
    }
    for (const ref of extractCustomPropertyReferences(value)) {
      if (!knownCssProperties.has(ref.name)) {
        errors.push(
          `  ${label}: context override "${prop}" references "${ref.name}", which is not defined in publicTokens`,
        );
      }
    }
  }
}

function extractCustomPropertyReferences(
  value: string,
): CustomPropertyReference[] {
  return [...value.matchAll(/var\(\s*(--[^,)\s]+)\s*(,)?/g)].map((m) => ({
    name: m[1],
    hasFallback: !!m[2],
  }));
}

/**
 * Replaces each `var(--sky-ctx-override-*, <fallback>)` with its fallback, so the public API
 * JSON shows the value consumers get outside a container.
 */
function removeContextOverrideReferences(value: string): string {
  const pattern = new RegExp(
    `var\\(\\s*${CONTEXT_OVERRIDE_PREFIX}[^,)\\s]*\\s*,`,
    'g',
  );
  let result = value;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(result))) {
    const fallbackStart = match.index + match[0].length;
    let depth = 1;
    let end = fallbackStart;
    while (end < result.length && depth > 0) {
      if (result[end] === '(') {
        depth++;
      } else if (result[end] === ')') {
        depth--;
      }
      end++;
    }
    if (depth > 0) {
      break;
    }
    const fallback = result.slice(fallbackStart, end - 1).trim();
    result = result.slice(0, match.index) + fallback + result.slice(end);
    // The fallback may itself contain a context override reference.
    pattern.lastIndex = match.index;
  }

  return result;
}

function toDocsStyle(style: PublicApiStyle): PublicApiStyle {
  const docsStyle = { ...style };
  delete docsStyle.contextOverrides;
  delete docsStyle.resetContextOverrides;
  if (docsStyle.properties) {
    docsStyle.properties = Object.fromEntries(
      Object.entries(docsStyle.properties).map(([prop, value]) => [
        prop,
        removeContextOverrideReferences(value),
      ]),
    );
  }
  return docsStyle;
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
      // The public API JSON never exposes context overrides.
      target.push(includeExcluded ? style : toDocsStyle(style));
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
