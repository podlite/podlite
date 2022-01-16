import { build } from 'esbuild';
import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp';

build({
  plugins: [pnpPlugin()],
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom', 'codemirror', 'react-codemirror2'],
  minify: true,
  format: 'esm',
  target: 'node12.0',
  sourcemap: true,
  outfile: 'esm/index.js',
}).catch((e) => {
  console.log('Build not successful', e.message);
  process.exit(1);
});