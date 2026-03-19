import { DemoMetadata } from '../../types/demo-metadata.js';
import { PublicApiTokenGroup } from '../../types/public-api-token-group.js';
import { PublicApiToken } from '../../types/public-api-token.js';
import { PublicApiTokens } from '../../types/public-api-tokens.js';

export function collectPublicTokenCustomProperties(
  api: PublicApiTokens,
  result = new Set<string>(),
): Set<string> {
  collectFromTokensNode(api, result);
  return result;
}

export function mergePublicApiResults(
  target: PublicApiTokens,
  source: PublicApiTokens,
): void {
  // Process keys in source order to preserve the consumer's property ordering
  // (e.g. whether groups or tokens appears first in their JSON).
  for (const key of Object.keys(source)) {
    if (key === 'groups' && source.groups) {
      target.groups ??= [];
      mergePublicApiGroupArrays(target.groups, source.groups);
    } else if (key === 'tokens' && source.tokens) {
      target.tokens ??= [];
      mergeTokenArrays(target.tokens, source.tokens);
    }
  }
}

export function applyDemoMetadataInheritance(api: PublicApiTokens): void {
  for (const group of api.groups ?? []) {
    applyGroupDemoMetadata(group, undefined);
  }
}

export function validatePublicApiTokensDocs(
  docsCustomProperties: Set<string>,
  generatedCustomProperties: Set<string>,
  tokenSetName: string,
): void {
  const errors: string[] = [];

  for (const prop of docsCustomProperties) {
    if (!generatedCustomProperties.has(prop)) {
      errors.push(
        `"${prop}" is in the docs but is not generated in the public API`,
      );
    }
  }
  for (const prop of generatedCustomProperties) {
    if (!docsCustomProperties.has(prop)) {
      errors.push(
        `"${prop}" is generated in the public API but is not included in the docs`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Token docs validation failed for "${tokenSetName}":\n  ${errors.join('\n  ')}`,
    );
  }
}

function collectFromTokensNode(
  node: { tokens?: PublicApiToken[]; groups?: PublicApiTokenGroup[] },
  result: Set<string>,
): void {
  for (const token of node.tokens ?? []) {
    if (token.customProperty) {
      result.add(token.customProperty);
    }
  }
  for (const group of node.groups ?? []) {
    collectFromTokensNode(group, result);
  }
}

function stableTokenKey(token: PublicApiToken): string {
  if (token.customProperty) {
    return token.customProperty;
  }
  const dep = token.deprecatedCustomProperties
    ? [...token.deprecatedCustomProperties].sort().join('|')
    : '';
  const obs = token.obsoleteCustomProperties
    ? [...token.obsoleteCustomProperties].sort().join('|')
    : '';
  return `${dep}::${obs}::${token.name}`;
}

function mergeTokenArrays(
  target: PublicApiToken[],
  source: PublicApiToken[],
): void {
  for (const token of source) {
    if (!target.some((t) => stableTokenKey(t) === stableTokenKey(token))) {
      target.push(token);
    }
  }
}

function mergePublicApiGroupArrays(
  target: PublicApiTokenGroup[],
  source: PublicApiTokenGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.groupName === srcGroup.groupName);
    if (existing) {
      existing.description ??= srcGroup.description;
      existing.demoMetadata ??= srcGroup.demoMetadata;
      if (srcGroup.tokens) {
        existing.tokens ??= [];
        mergeTokenArrays(existing.tokens, srcGroup.tokens);
      }
      if (srcGroup.groups) {
        existing.groups ??= [];
        mergePublicApiGroupArrays(existing.groups, srcGroup.groups);
      }
    } else {
      target.push(srcGroup);
    }
  }
}

function applyGroupDemoMetadata(
  group: PublicApiTokenGroup,
  inherited: DemoMetadata | undefined,
): void {
  const accumulated = group.demoMetadata
    ? { ...inherited, ...group.demoMetadata }
    : inherited;

  if (group.tokens && accumulated) {
    for (const token of group.tokens) {
      token.demoMetadata = { ...accumulated, ...token.demoMetadata };
    }
  }

  if (group.groups) {
    for (const subgroup of group.groups) {
      applyGroupDemoMetadata(subgroup, accumulated);
    }
  }
}
