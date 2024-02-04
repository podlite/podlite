import { build, BuildOptions } from 'esbuild';
const opt: BuildOptions = {
    tsconfig: 'tsconfig-esm.json',
}
build({
  bundle: true,
  entryPoints: ['src/index.tsx'],
  external: ['react', 'react-dom'],
  minify: false,
  format: 'esm',
  target: 'es2019',
  sourcemap: true,
  outfile: 'lib/index.esm.js',
  ...opt
}).catch((e) => {
  console.log('Build not successful', e.message);
  process.exit(1);
});