import fs from 'node:fs';
import path from 'node:path';
import { getAppVersionMetadata, injectLearnerVersionIntoIndex, injectManagementVersionIntoBundle } from './app-version';

const mode = process.argv[2];
const metadata = getAppVersionMetadata();

if (mode === 'pages') {
  const indexPath = path.resolve('dist/index.html');
  if (!fs.existsSync(indexPath)) throw new Error('VERSION_DIST_INDEX_NOT_FOUND');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const updated = injectLearnerVersionIntoIndex(indexHtml, metadata);
  fs.writeFileSync(indexPath, updated);
  console.log(`[version] learner main screen: Version ${metadata.version} Build ${metadata.build}`);
} else if (mode === 'server') {
  const serverPath = path.resolve('dist/server.cjs');
  if (!fs.existsSync(serverPath)) throw new Error('VERSION_DIST_SERVER_NOT_FOUND');
  const serverBundle = fs.readFileSync(serverPath, 'utf8');
  const updated = injectManagementVersionIntoBundle(serverBundle, metadata);
  fs.writeFileSync(serverPath, updated);
  console.log(`[version] management UI: Version ${metadata.version} Build ${metadata.build}`);
} else {
  throw new Error('Usage: tsx scripts/app-version-postbuild.ts pages|server');
}
