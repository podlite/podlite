import { build } from 'esbuild';

build({
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom'],
  minify: true,
  format: 'esm',
  target: 'node14',
  sourcemap: true,
  outfile: 'esm/index.js',
}).catch((e) => {
  console.log('Build not successful', e.message);
  process.exit(1);
});