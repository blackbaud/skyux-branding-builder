import fsPromises from 'node:fs/promises';
import path from 'node:path';

try {
  await fsPromises.copyFile(
    'package.json',
    path.normalize('dist/package.json'),
  );
} catch (err) {
  console.error(err);
  process.exit(1);
}
