import { build } from 'esbuild';
// import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp';

build({
//   plugins: [pnpPlugin()],
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom', 'codemirror', 'react-codemirror2'],
  minify: false,
  format: 'cjs',
  target: 'es2019',
  platform: 'browser',
  sourcemap: true,
  outfile: 'lib/index.cjs',
}).catch((e) => {
  console.log('Build not successful', e.message);
  process.exit(1);
});