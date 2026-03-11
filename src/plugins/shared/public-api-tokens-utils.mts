import { Token, TransformedTokens } from 'style-dictionary';

import { PublicApiTokenGroup } from '../../types/public-api-token-group.js';
import { PublicApiToken } from '../../types/public-api-token.js';
import { PublicApiTokens } from '../../types/public-api-tokens.js';

const EXTENSIONS_NAMESPACE = 'com.blackbaud.developer.docs';

interface BlackbaudDocsExtensions {
  groupName?: string;
  name?: string;
  deprecatedCustomProperties?: string[];
}

export function buildPublicApiGroups(
  allTokens: Token[],
  tokenTree: TransformedTokens,
): PublicApiTokens {
  const result: PublicApiTokens = {};

  for (const token of allTokens) {
    // Walk the token's path through the raw token tree, collecting any ancestor
    // nodes that declare a groupName extension. This becomes an ordered list of
    // groups from outermost to innermost (e.g. [Colors, Text Colors]).
    const groupPath: { groupName: string; description?: string }[] = [];
    let current: TransformedTokens = tokenTree;

    for (const segment of token.path) {
      current = current[segment];
      const node = current as Token;
      const nodeExt = getDocsExt(node.$extensions);
      if (nodeExt.groupName) {
        groupPath.push({
          groupName: nodeExt.groupName,
          description: node.$description,
        });
      }
    }

    const tokenExt = getDocsExt(token.$extensions);
    const tokenEntry: PublicApiToken = {
      name: tokenExt.name ?? token.name ?? '',
      customProperty: `--${token.name}`,
    };

    if (token.$description) {
      tokenEntry.description = token.$description;
    }

    if (tokenExt.deprecatedCustomProperties) {
      tokenEntry.deprecatedCustomProperties = tokenExt.deprecatedCustomProperties;
    }

    // Tokens with no group ancestry go to the top-level tokens array.
    if (groupPath.length === 0) {
      result.tokens ??= [];
      result.tokens.push(tokenEntry);
    } else {
      // Walk (or create) the nested group structure, then place the token in
      // the innermost group.
      result.groups ??= [];
      let currentGroups = result.groups;

      for (let i = 0; i < groupPath.length; i++) {
        const { groupName, description } = groupPath[i];
        let group = currentGroups.find((g) => g.groupName === groupName);
        if (!group) {
          group = { groupName };
          currentGroups.push(group);
        }
        if (description && !group.description) {
          group.description = description;
        }
        if (i < groupPath.length - 1) {
          // Intermediate group: descend into its subgroups.
          group.groups ??= [];
          currentGroups = group.groups;
        } else {
          // Leaf group: append the token here.
          group.tokens ??= [];
          group.tokens.push(tokenEntry);
        }
      }
    }
  }

  return result;
}

export function mergePublicApiResults(
  target: PublicApiTokens,
  source: PublicApiTokens,
): void {
  if (source.tokens) {
    target.tokens ??= [];
    for (const token of source.tokens) {
      if (!target.tokens.some((t) => stableTokenKey(t) === stableTokenKey(token))) {
        target.tokens.push(token);
      }
    }
  }
  if (source.groups) {
    target.groups ??= [];
    mergePublicApiGroupArrays(target.groups, source.groups);
  }
}

export function collectPublicTokenCssProperties(
  api: PublicApiTokens,
  result = new Set<string>(),
): Set<string> {
  if (api.tokens) {
    for (const token of api.tokens) {
      if (token.customProperty) {
        result.add(token.customProperty);
      }
    }
  }
  if (api.groups) {
    for (const group of api.groups) {
      collectGroupCssProperties(group, result);
    }
  }
  return result;
}

function getDocsExt(
  extensions: Record<string, unknown> | undefined,
): BlackbaudDocsExtensions {
  return (extensions?.[EXTENSIONS_NAMESPACE] ?? {}) as BlackbaudDocsExtensions;
}

function mergePublicApiGroupArrays(
  target: PublicApiTokenGroup[],
  source: PublicApiTokenGroup[],
): void {
  for (const srcGroup of source) {
    const existing = target.find((g) => g.groupName === srcGroup.groupName);
    if (existing) {
      if (srcGroup.description && !existing.description) {
        existing.description = srcGroup.description;
      }
      if (srcGroup.tokens) {
        existing.tokens ??= [];
        for (const token of srcGroup.tokens) {
          if (
            !existing.tokens.some((t) => stableTokenKey(t) === stableTokenKey(token))
          ) {
            existing.tokens.push(token);
          }
        }
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

function collectGroupCssProperties(
  group: PublicApiTokenGroup,
  result: Set<string>,
): void {
  if (group.tokens) {
    for (const token of group.tokens) {
      if (token.customProperty) {
        result.add(token.customProperty);
      }
    }
  }
  if (group.groups) {
    for (const subgroup of group.groups) {
      collectGroupCssProperties(subgroup, result);
    }
  }
}

function stableTokenKey(token: PublicApiToken): string {
  return token.customProperty ?? token.deprecatedCustomProperties?.sort().join(',') ?? token.name;
}
