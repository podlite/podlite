import path from 'path'
import fse from 'fs-extra'

const packagePath = process.cwd()
const buildPath = path.join(packagePath, './lib')
const srcPath = path.join(packagePath, './src')

async function updateLinkedPackage() {
  const packageData = await fse.readFile(path.resolve(packagePath, './package.json'), 'utf8')
  const { ...packageDataOther } = JSON.parse(packageData)

  const newPackageData = {
    ...packageDataOther,
    ...(packageDataOther.main
      ? {
          main: fse.existsSync(path.resolve(buildPath, './index.js')) ? './lib/index.js' : './lib/index.cjs',
        }
      : {}),
  }
  if (fse.existsSync(path.resolve(packagePath, './esm/index.js'))) {
    newPackageData.module = './esm/index.js'
  }

  if (fse.existsSync(path.resolve(buildPath, './index.esm.js'))) {
    newPackageData.module = './lib/index.esm.js'
  }

  if (newPackageData.publishConfig && newPackageData.publishConfig.module) {
    newPackageData.module = newPackageData.publishConfig.module
  }
  return newPackageData
}

async function updateUnLinkedPackage() {
  const packageData = await fse.readFile(path.resolve(packagePath, './package.json'), 'utf8')
  const { module, ...packageDataOther } = JSON.parse(packageData)

  const newPackageData = {
    ...packageDataOther,
    ...(packageDataOther.main
      ? {
          main: fse.existsSync(path.resolve(srcPath, './index.tsx')) ? './src/index.tsx' : './src/index.ts',
        }
      : {}),
  }

  return newPackageData
}

async function upVersionPackage() {
  const packageData = await fse.readFile(path.resolve(packagePath, './package.json'), 'utf8')
  const newPackageData = JSON.parse(packageData)

  const newVersion = incrementVersion(newPackageData.version)

  newPackageData.version = newVersion

  return newPackageData
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
    if (isLinked) {
      const packageData = await updateLinkedPackage()
      const targetPath = path.resolve(packagePath, './package.json')
      console.log(`[isLinked] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
    if (isUnLinked) {
      const packageData = await updateUnLinkedPackage()
      const targetPath = path.resolve(packagePath, './package.json')
      console.log(`[isUnLinked] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
    if (isUpVersion) {
      const packageData = await upVersionPackage()
      const targetPath = path.resolve(packagePath, './package.json')
      console.log(`[UpVersion] Writing to ${targetPath}`)
      await fse.writeFile(targetPath, JSON.stringify(packageData, null, 2), 'utf8')
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
