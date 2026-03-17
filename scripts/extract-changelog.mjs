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

=begin defn
C<--dry-run>

Show what would be changed without writing files. Use with --update.
=end defn

=begin defn
C<--aggregate>

Collect Upcoming sections from all per-package changelogs and write them
into the root CHANGELOG.podlite under =head2 @package headers.
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
  return src.replace(regex, `=head1 ${newHeader}\n\n=head1 ${before}`)
}

const isReleaseEmptyContent = (changelog, release) => {
  const headerRegex = new RegExp(`^=head1\\s+${release}\\s*$`, 'm')
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
      // Convert podlite to markdown
      const mdContent = sectionContent
        .replace(/^=item\s+/gm, '- ')
        .replace(/C<([^>]+)>/g, '`$1`')
        .replace(/C<< ([^>]+) >>/g, '`$1`')
        .trim()
      return `# ${pkg.name}@${pkg.version}\n\n${mdContent}`
    }
  }
  return undefined
}

const getUpcomingContent = changelog => {
  const headerRegex = /^=head1\s+Upcoming\s*$/m
  const match = headerRegex.exec(changelog)
  if (!match) return ''

  const start = match.index + match[0].length
  const nextHeaderRegex = /^=head1\s+/gm
  nextHeaderRegex.lastIndex = start
  const nextMatch = nextHeaderRegex.exec(changelog)
  const end = nextMatch ? nextMatch.index : changelog.length

  return changelog.substring(start, end).trim()
}

const processChangelog = (changelogPath, args) => {
  const dir = path.dirname(changelogPath)
  const packageJsonPath = path.join(dir, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    return
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const version = pkg.version
  let changelog = fs.readFileSync(changelogPath, 'utf8')
  const dryRun = args.includes('--dry-run')

  if (args.includes('--update')) {
    if (isReleaseEmptyContent(changelog, 'Upcoming')) {
      console.log(`[${pkg.name}] Upcoming section is empty. Skipping.`)
      return
    }
    changelog = renameHeaderInPodlite(changelog, 'Upcoming', version)
    changelog = insertRecordBeforeRelease(changelog, version, 'Upcoming')

    if (dryRun) {
      console.log(`[${pkg.name}] Would update CHANGELOG.podlite: Upcoming → ${version}`)
    } else {
      fs.writeFileSync(changelogPath, changelog)
      console.log(`[${pkg.name}] Updated CHANGELOG.podlite: Upcoming → ${version}`)
    }
    return
  }

  if (args.includes('--summary')) {
    // Skip private packages (root monorepo) — per-package changelogs are enough
    if (pkg.private) return
    const content = getReleaseContent(changelog, version, pkg)
    if (content) {
      console.log(content)
    }
  }
}

async function run() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  // Find all CHANGELOG.pod6 and CHANGELOG.podlite files
  const files = glob.sync('**/CHANGELOG.{pod6,podlite}', { cwd, absolute: true, ignore: ['**/node_modules/**'] })

  if (args.includes('--aggregate')) {
    // Collect Upcoming from per-package changelogs → write to root CHANGELOG.podlite
    const rootChangelog = path.resolve(cwd, 'CHANGELOG.podlite')
    const sections = []

    for (const file of files) {
      if (file === rootChangelog) continue
      const dir = path.dirname(file)
      const pkgPath = path.join(dir, 'package.json')
      if (!fs.existsSync(pkgPath)) continue

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkg.private) continue

      const changelog = fs.readFileSync(file, 'utf8')
      const upcoming = getUpcomingContent(changelog)
      if (upcoming) {
        sections.push(`=head2 ${pkg.name}\n\n${upcoming}`)
      }
    }

    if (sections.length === 0) {
      console.log('No per-package Upcoming entries found.')
      return
    }

    const aggregated = sections.join('\n\n')

    if (!fs.existsSync(rootChangelog)) {
      console.log('Root CHANGELOG.podlite not found.')
      return
    }

    let root = fs.readFileSync(rootChangelog, 'utf8')
    // Replace Upcoming section content in root
    const upcomingRegex = /^(=head1 Upcoming)\s*$/m
    const match = upcomingRegex.exec(root)
    if (!match) {
      console.log('No =head1 Upcoming in root CHANGELOG.podlite.')
      return
    }

    const start = match.index + match[0].length
    const nextHeader = /^=head1\s+/gm
    nextHeader.lastIndex = start
    const nextMatch = nextHeader.exec(root)
    const end = nextMatch ? nextMatch.index : root.length

    const newRoot = root.substring(0, start) + '\n\n' + aggregated + '\n\n' + root.substring(end)

    if (dryRun) {
      console.log('Would write to root CHANGELOG.podlite:\n')
      console.log(aggregated)
    } else {
      fs.writeFileSync(rootChangelog, newRoot)
      console.log(`Root CHANGELOG.podlite updated with ${sections.length} package(s).`)
    }
    return
  }

  for (const file of files) {
    processChangelog(file, args)
  }
}

run()
