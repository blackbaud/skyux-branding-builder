import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AssetsConfig } from './assets-config.js';

export function fixAssetsUrl(
  basePath: string | undefined,
  value: string,
  projectName: string,
): string {
  const effectiveBasePath = getBasePath(basePath, projectName);

  if (effectiveBasePath !== undefined) {
    if (effectiveBasePath === basePath) {
      // Local path - replace ~/assets/ with the base path
      value = value.replace(/~\/assets\//g, effectiveBasePath);
    } else {
      // CDN path - replace ~/ with the CDN base path
      value = value.replace(/~\//g, effectiveBasePath);
    }
  }

  return value;
}

export function fixAssetsUrlValue(
  basePath: string | undefined,
  value: string,
  projectName: string,
): string {
  const rawUrl = fixAssetsUrl(basePath, value, projectName);
  return `url('${rawUrl}')`;
}

export async function generateAssetsCss(
  basePath: string,
  projectName: string,
): Promise<string> {
  const assetsJsonPath = join('public', 'assets', 'assets.json');

  try {
    // Check if assets.json exists
    if (!existsSync(assetsJsonPath)) {
      console.warn('assets.json not found in public/assets folder');
      return '';
    }

    // Read and parse assets.json
    const assetsContent = await readFile(assetsJsonPath, 'utf-8');
    const assetsConfig: AssetsConfig = JSON.parse(assetsContent);

    if (!assetsConfig.fonts || assetsConfig.fonts.length === 0) {
      console.warn('No fonts found in assets.json');
      return '';
    }

    // Generate CSS font declarations
    const fontFaceDeclarations = assetsConfig.fonts
      .map((font) => {
        return `@font-face {
  font-family: '${font.family}';
  src: ${fixAssetsUrlValue(basePath, font.src, projectName)};
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}`;
      })
      .join('\n\n');

    return fontFaceDeclarations;
  } catch (error) {
    console.error('Error generating font CSS:', error);
    throw error;
  }
}

function getBasePath(
  basePath: string | undefined,
  projectName: string,
): string | undefined {
  const packageVersion = process.env.PACKAGEJSON_VERSION;

  if (packageVersion) {
    return `https://sky.blackbaudcdn.net/static/${projectName}/${packageVersion}/`;
  }
  return basePath;
}
