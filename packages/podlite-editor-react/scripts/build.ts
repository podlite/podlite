import { build } from 'esbuild';
import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp';

build({
  plugins: [pnpPlugin()],
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom', 'react-codemirror2'],
  minify: true,
  format: 'cjs',
  target: 'node12.0',
  sourcemap: true,
  outfile: 'lib/index.js',
}).catch((e) => {
  console.log('Build not successful', e.message);
  process.exit(1);
});