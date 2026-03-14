import * as fs from 'fs'
import * as path from 'path'
import { parse, toMarkdown, toHtml } from '@podlite/schema'

const FORMATS: Record<string, string> = {
  md: '.md',
  markdown: '.md',
  html: '.html',
}

function usage() {
  console.log(`Usage: podlite convert <files...> --to <format> [-o <output>]

Commands:
  convert    Convert Podlite files to another format

Options:
  --to       Output format: md (markdown), html
  -o         Output file or directory (default: same dir, new extension)
  --help     Show this help

Examples:
  podlite convert doc.pod6 --to md
  podlite convert *.pod6 --to md -o output/
  podlite convert README.pod6 --to md -o README.md`)
}

function parseArgs(argv: string[]) {
  const args = {
    command: '',
    files: [] as string[],
    to: '',
    output: '',
  }

  let i = 0
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return null
  }

  args.command = argv[i++]

  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--to') {
      args.to = argv[++i] || ''
    } else if (arg === '-o') {
      args.output = argv[++i] || ''
    } else if (arg === '--help' || arg === '-h') {
      return null
    } else if (!arg.startsWith('-')) {
      args.files.push(arg)
    }
    i++
  }
  return args
}

function convertFile(inputPath: string, format: string, outputPath?: string): void {
  const ext = FORMATS[format]
  if (!ext) {
    console.error(`Unknown format: ${format}. Supported: ${Object.keys(FORMATS).join(', ')}`)
    process.exit(1)
  }

  const content = fs.readFileSync(inputPath, 'utf-8')
  const tree = parse(content)

  let result: string
  if (format === 'md' || format === 'markdown') {
    result = toMarkdown({}).run(tree).toString()
  } else if (format === 'html') {
    result = toHtml({}).run(tree).toString()
  } else {
    console.error(`Format "${format}" not implemented yet`)
    process.exit(1)
  }

  if (outputPath) {
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      const basename = path.basename(inputPath, path.extname(inputPath))
      const outFile = path.join(outputPath, basename + ext)
      fs.writeFileSync(outFile, result)
      console.log(`${inputPath} → ${outFile}`)
    } else {
      fs.writeFileSync(outputPath, result)
      console.log(`${inputPath} → ${outputPath}`)
    }
  } else {
    const dir = path.dirname(inputPath)
    const basename = path.basename(inputPath, path.extname(inputPath))
    const outFile = path.join(dir, basename + ext)
    fs.writeFileSync(outFile, result)
    console.log(`${inputPath} → ${outFile}`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args) {
    usage()
    process.exit(0)
  }

  if (args.command !== 'convert') {
    console.error(`Unknown command: ${args.command}`)
    usage()
    process.exit(1)
  }

  if (args.files.length === 0) {
    console.error('No input files specified')
    usage()
    process.exit(1)
  }

  if (!args.to) {
    console.error('Missing --to <format>')
    usage()
    process.exit(1)
  }

  if (args.files.length > 1 && args.output && !fs.existsSync(args.output)) {
    fs.mkdirSync(args.output, { recursive: true })
  }

  for (const file of args.files) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`)
      process.exit(1)
    }
    convertFile(file, args.to, args.output || undefined)
  }
}

main()
