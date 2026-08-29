import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { getAppVersionMetadata, injectManagementVersionIntoBundle } from './app-version';

const metadata = getAppVersionMetadata();
const managementPath = path.resolve('src/server/managementPage.ts');

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/server.cjs',
  plugins: [
    {
      name: 'management-version-ui',
      setup(esbuild) {
        esbuild.onLoad({ filter: /managementPage\.ts$/ }, async (args) => {
          if (path.resolve(args.path) !== managementPath) return null;
          const source = await fs.readFile(args.path, 'utf8');
          return {
            contents: injectManagementVersionIntoBundle(source, metadata),
            loader: 'ts',
          };
        });
      },
    },
  ],
});

console.log(`[version] management UI: Version ${metadata.version} Build ${metadata.build}`);
