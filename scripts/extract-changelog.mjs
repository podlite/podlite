/*
=NAME
extract-changelog.mjs - Script to manage and extract changelog entries

=SYNOPSIS
node scripts/extract-changelog.mjs [options]

=DESCRIPTION
This script processes C<CHANGELOG.podlite> files across the monorepo.
It can update the 'Upcoming' section with the current version or extract a summary of changes for a specific version.

=OPTIONS
=begin defn 
C<--update>

Rename the 'Upcoming' section to the current version found in package.json and insert a new 'Upcoming' header.
=end defn

=begin defn
C<--summary>

Extract and print the changes for the current version of the package.
=end defn
*/
import fs from 'fs'
import path from 'path'
import glob from 'glob'

const cwd = process.cwd()

// Helper functions
const renameHeaderInPodlite = (src, from, to) => {
  const regex = new RegExp(`^=head1 ${from}$`, 'm')
  return src.replace(regex, `=head1 ${to}`)
}

const insertRecordBeforeRelease = (src, before, newHeader) => {
  const regex = new RegExp(`^=head1 ${before}$`, 'm')
  return src.replace(regex, `=head1 ${before}\n\n=head1 ${newHeader}`)
}

const isReleaseEmptyContent = (changelog, release) => {
  const headerRegex = new RegExp(`^=head1\s+${release}\s*$`, 'm')
  const match = headerRegex.exec(changelog)
  if (!match) return true

  const start = match.index + match[0].length
  const nextHeaderRegex = /^=head1\s+/gm
  nextHeaderRegex.lastIndex = start
  const nextMatch = nextHeaderRegex.exec(changelog)
  const end = nextMatch ? nextMatch.index : changelog.length

  const content = changelog.substring(start, end)
  return !/\S/.test(content)
}

const getReleaseContent = (changelog, version, pkg) => {
  const headerRegex = /^=head1\s+(.*)$/gm
  let match
  const headers = []
  while ((match = headerRegex.exec(changelog)) !== null) {
    headers.push({
      version: match[1].trim(),
      start: match.index + match[0].length,
      index: match.index,
    })
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    const isCurrent = h.version === version
    const end = headers[i + 1] ? headers[i + 1].index : changelog.length
    const sectionContent = changelog.substring(h.start, end)

    if (isCurrent) {
      const content = sectionContent
      return `=head2 ${pkg.name}/${pkg.version} ${content}`
    }
  }
  return undefined
}

const processChangelog = (changelogPath, args) => {
  const dir = path.dirname(changelogPath)
  const packageJsonPath = path.join(dir, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    // console.warn(`Skipping ${changelogPath}: package.json not found`)
    return
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const version = pkg.version
  let changelog = fs.readFileSync(changelogPath, 'utf8')

  if (args.includes('--update')) {
    if (isReleaseEmptyContent(changelog, 'Upcoming')) {
      console.log(`[${pkg.name}] Upcoming section is empty. Skipping update.`)
      return
    }
    changelog = renameHeaderInPodlite(changelog, 'Upcoming', version)
    changelog = insertRecordBeforeRelease(changelog, version, 'Upcoming')

    fs.writeFileSync(changelogPath, changelog)
    console.log(`[${pkg.name}] Updated CHANGELOG.pod6 for version ${version}`)
    return
  }

  if (args.includes('--summary')) {
    const content = getReleaseContent(changelog, version, pkg)
    if (content) {
      console.log(content)
    } else {
      // console.warn('no content for ' + JSON.stringify({changelog, version, pkg}, null, 2))
    }
  }
}

async function run() {
  const args = process.argv.slice(2)
  const rootChangelogPod6 = path.resolve(cwd, 'CHANGELOG.pod6')
  const rootChangelogPodlite = path.resolve(cwd, 'CHANGELOG.podlite')

  // Find all CHANGELOG.pod6 and CHANGELOG.podlite files
  const files = glob.sync('**/CHANGELOG.{pod6,podlite}', { cwd, absolute: true, ignore: ['**/node_modules/**'] })

  for (const file of files) {
    if (file === rootChangelogPod6 || file === rootChangelogPodlite) {
      continue
    }
    processChangelog(file, args)
  }
}

run()
