import path from 'path'
import fs from 'fs'

const fse = {
  readFile: (p, enc) => fs.promises.readFile(p, enc),
  writeFile: (p, data, enc) => fs.promises.writeFile(p, data, enc),
  existsSync: p => fs.existsSync(p),
}

const packagePath = process.cwd()
const srcPath = path.join(packagePath, './src')

const CJS_BUILD_RE = /build:cjs|index\.cjs/

function canonicalRoot(pkg) {
  const cjs = CJS_BUILD_RE.test(pkg.scripts?.build || '')
  const main = cjs ? './lib/index.cjs' : './lib/index.js'
  const module = cjs ? './lib/index.esm.js' : './esm/index.js'
  const types = './lib/index.d.ts'
  return { main, module, types }
}

function srcEntry() {
  return fse.existsSync(path.resolve(srcPath, './index.tsx')) ? './src/index.tsx' : './src/index.ts'
}

async function readManifest() {
  return JSON.parse(await fse.readFile(path.resolve(packagePath, './package.json'), 'utf8'))
}

async function updateLinkedPackage() {
  const pkg = await readManifest()
  const c = canonicalRoot(pkg)

  if (pkg.main) pkg.main = c.main
  pkg.module = c.module
  pkg.types = c.types

  if (pkg.exports && typeof pkg.exports === 'object' && pkg.exports['.']) {
    pkg.exports['.'] = {
      types: c.types,
      import: c.module,
      require: c.main,
      default: c.main,
    }
  }

  return pkg
}

async function updateUnLinkedPackage() {
  const pkg = await readManifest()
  const src = srcEntry()

  delete pkg.module
  delete pkg.types

  if (pkg.main) pkg.main = src

  if (pkg.exports && typeof pkg.exports === 'object' && pkg.exports['.']) {
    pkg.exports['.'] = src
  }

  return pkg
}

async function upVersionPackage() {
  const pkg = await readManifest()
  pkg.version = incrementVersion(pkg.version)
  return pkg
}

function incrementVersion(version) {
  const versionParts = version.split('.')
  const lastPart = parseInt(versionParts[versionParts.length - 1])
  versionParts[versionParts.length - 1] = (lastPart + 1).toString()
  return versionParts.join('.')
}

async function run() {
  const extraArgs = process.argv.slice(2)
  const args = extraArgs.filter(arg => arg.startsWith('--'))

  try {
    const isLinked = args.includes('--set-linked')
    const isUnLinked = args.includes('--set-unlinked')
    const isUpVersion = args.includes('--set-upversion')
    const targetPath = path.resolve(packagePath, './package.json')

    if (isLinked) {
      const packageData = await updateLinkedPackage()
      console.log(`[isLinked] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
    if (isUnLinked) {
      const packageData = await updateUnLinkedPackage()
      console.log(`[isUnLinked] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
    if (isUpVersion) {
      const packageData = await upVersionPackage()
      console.log(`[UpVersion] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
