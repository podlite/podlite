import * as fs from 'fs'
import * as path from 'path'
import { parse, toMarkdown, toHtml } from '@podlite/schema'
import { runLint, LintFormat } from './lint'
import { runQuery, QueryFormat } from './query'

const FORMATS: Record<string, string> = {
  md: '.md',
  markdown: '.md',
  html: '.html',
}

const QUERY_FORMATS: QueryFormat[] = ['podlite', 'md', 'html', 'json']
const LINT_FORMATS: LintFormat[] = ['text', 'json']

function usage() {
  console.log(`Usage:
  podlite convert <files...> --to <format> [-o <output>]
  podlite lint <files...> [--strict] [--format <text|json>] [--config <path>]
  podlite query <selector> <files...> [--to <format>] [--fail-on-empty] [--quiet]

Commands:
  convert    Convert Podlite files to another format
  lint       Check Podlite/Markdown files for issues (work in progress)
  query      Extract blocks matching a selector

Options:
  --to       Output format
               convert: md (markdown), html
               query:   podlite (default), md, html, json
  --format   lint output format: text (default), json
  --strict   lint: promote warnings to errors
  --config   lint: path to .podlitelintrc.{json,js}
  -o         Output file or directory (default: same dir, new extension)
  --fail-on-empty  query: exit 1 if no blocks matched
  --quiet    query: suppress match count on stderr
  --help     Show this help

Examples:
  podlite convert doc.pod6 --to md
  podlite convert *.pod6 --to md -o output/
  podlite query 'head1' docs/api.podlite
  podlite query 'head1, head2' manual.podlite --to md
  podlite query 'code[:lang<python>]' tutorials/*.podlite --to json
  podlite query '*[:applies-nfr~<N004>]' rules/*.podlite --fail-on-empty
  cat doc.podlite | podlite query 'head1'
  podlite query 'table' --to json - < report.podlite
  podlite lint docs/*.podlite
  podlite lint docs/ --strict --format json`)
}

function parseArgs(argv: string[]) {
  const args = {
    command: '',
    files: [] as string[],
    to: '',
    output: '',
    failOnEmpty: false,
    quiet: false,
    strict: false,
    format: '',
    configPath: '',
  }

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return null
  }

  let i = 0
  args.command = argv[i++]

  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--to' || arg === '-t') {
      args.to = argv[++i] || ''
    } else if (arg === '-o') {
      args.output = argv[++i] || ''
    } else if (arg === '--fail-on-empty') {
      args.failOnEmpty = true
    } else if (arg === '--quiet') {
      args.quiet = true
    } else if (arg === '--strict') {
      args.strict = true
    } else if (arg === '--format') {
      args.format = argv[++i] || ''
    } else if (arg === '--config') {
      args.configPath = argv[++i] || ''
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

function readStdinSync(): string {
  return fs.readFileSync(0, 'utf-8')
}

function runQueryCommand(args: ReturnType<typeof parseArgs>): never {
  if (!args) process.exit(1)

  // First positional arg is the selector, rest are files
  if (args.files.length === 0) {
    console.error('podlite query: missing selector')
    usage()
    process.exit(1)
  }
  const selector = args.files[0]
  const positional = args.files.slice(1)

  // '-' is explicit stdin marker. Piped input (stdin not a TTY) is also treated as input.
  const stdinIsPiped = !process.stdin.isTTY
  const hasDashMarker = positional.includes('-')
  const files = positional.filter(f => f !== '-')
  let stdinContent: string | undefined
  if (hasDashMarker || (stdinIsPiped && files.length === 0)) {
    stdinContent = readStdinSync()
  }

  if (files.length === 0 && stdinContent === undefined) {
    console.error('podlite query: missing input files (and no stdin)')
    usage()
    process.exit(1)
  }

  const format = (args.to || 'podlite') as QueryFormat
  if (!QUERY_FORMATS.includes(format)) {
    console.error(`podlite query: unknown --to format "${format}". Supported: ${QUERY_FORMATS.join(', ')}`)
    process.exit(1)
  }

  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`File not found: ${f}`)
      process.exit(1)
    }
  }

  try {
    const result = runQuery({
      selector,
      files,
      format,
      failOnEmpty: args.failOnEmpty,
      quiet: args.quiet,
      stdinContent,
    })
    if (args.output) {
      fs.writeFileSync(args.output, result.output)
    } else if (result.output) {
      process.stdout.write(result.output)
      if (!result.output.endsWith('\n')) process.stdout.write('\n')
    }
    if (!args.quiet) {
      console.error(`${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`)
    }
    process.exit(result.exitCode)
  } catch (e) {
    console.error(`podlite query: ${(e as Error).message}`)
    process.exit(1)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args) {
    usage()
    process.exit(0)
  }

  if (args.command === 'query') {
    runQueryCommand(args)
  }

  if (args.command === 'lint') {
    if (args.files.length === 0) {
      console.error('podlite lint: no input files specified')
      usage()
      process.exit(2)
    }
    const format = (args.format || 'text') as LintFormat
    if (!LINT_FORMATS.includes(format)) {
      console.error(`podlite lint: unknown --format "${format}". Supported: ${LINT_FORMATS.join(', ')}`)
      process.exit(2)
    }
    process.exit(
      runLint(args.files, {
        strict: args.strict,
        format,
        configPath: args.configPath || undefined,
      }),
    )
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
