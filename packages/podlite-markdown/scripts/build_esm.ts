import { build, BuildOptions } from 'esbuild'
import { readFileSync } from 'fs'
import { join } from 'path'

const externalDependencies = (): string[] => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
  return Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
}
const opt: BuildOptions = {
  tsconfig: 'tsconfig-esm.json',
}
build({
  bundle: true,
  entryPoints: ['src/index.tsx'],
  // The dependencies pick their own implementation per environment: the character
  // decoder, for one, serves a DOM version to browsers and a table to everyone else.
  // Bundling them froze the browser choice into the file Node also loads.
  //
  // Read from the manifest rather than listed here, so a dependency added later is
  // not silently bundled again.
  external: externalDependencies(),
  minify: false,
  format: 'esm',
  target: 'es2019',
  sourcemap: true,
  outfile: 'lib/index.esm.js',
  ...opt,
}).catch(e => {
  console.log('Build not successful', e.message)
  process.exit(1)
})
