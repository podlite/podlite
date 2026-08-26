// Shiki is an optional peer, so its types are described here rather than
// imported: a consumer that never highlights must still type-check and build
// with the package absent.
export type BundledLanguage = string
export type BundledTheme = string

export type DecorationItem = {
  start: number
  end: number
  tagName?: string
  properties?: Record<string, string>
}

type CodeToHtmlOptions = {
  lang: string
  theme?: BundledTheme
  themes?: { light: BundledTheme; dark: BundledTheme }
  decorations?: DecorationItem[]
}

export type Highlighter = {
  codeToHtml: (code: string, options: CodeToHtmlOptions) => string
  loadLanguage: (lang: BundledLanguage) => Promise<void>
}

type ShikiModule = {
  bundledLanguages: Record<string, unknown>
  createHighlighter: (options: { themes: BundledTheme[]; langs: BundledLanguage[] }) => Promise<Highlighter>
}

const isShikiModule = (m: unknown): m is ShikiModule =>
  typeof m === 'object' && m !== null && 'createHighlighter' in m && 'bundledLanguages' in m

// A rejected import and an unusable module are the same event to the caller:
// highlighting is unavailable, and the caller falls back to plain output.
const loadShiki = async (): Promise<ShikiModule> => {
  const module: unknown = await import('shiki')
  if (!isShikiModule(module)) throw new Error('shiki is not available')
  return module
}

type Config = {
  themes: { light: BundledTheme; dark: BundledTheme }
  initialLanguages: BundledLanguage[]
}

const CONFIG: Config = {
  themes: {
    light: 'one-light',
    dark: 'github-dark',
  },
  // Only the fallback grammar is preloaded; everything else arrives through
  // loadLanguage when a block asks for it.
  initialLanguages: ['txt'],
}

export type ExtendedLanguage = BundledLanguage | 'txt'

// Language aliases mapping
const languageAliases: Record<string, ExtendedLanguage> = {
  text: 'txt',
  plaintext: 'txt',
  plain: 'txt',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shellscript: 'shell',
  'shell-script': 'shell',
  console: 'shell',
  terminal: 'shell',
  js: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  ts: 'typescript',
  py: 'python',
  python3: 'python',
  py3: 'python',
  rb: 'ruby',
  md: 'markdown',
  cpp: 'c++',
  cc: 'c++',
  cs: 'c#',
  csharp: 'c#',
  htm: 'html',
  yml: 'yaml',
  dockerfile: 'docker',
  styles: 'css',
  style: 'css',
  jsonc: 'json',
  json5: 'json',
  xaml: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  mysql: 'sql',
  postgresql: 'sql',
  postgres: 'sql',
  pgsql: 'sql',
  plsql: 'sql',
  oracle: 'sql',
}

type State = {
  instance: Highlighter | null
  initPromise: Promise<Highlighter> | null
  loadedLanguages: Set<ExtendedLanguage>
  pendingLoads: Map<ExtendedLanguage, Promise<void>>
  warnedLanguages: Set<string>
}

// One highlighter for the process: both the renderer and the editor reach it
// through this module, so a grammar is fetched once however many views ask.
const state: State = {
  instance: null,
  initPromise: null,
  loadedLanguages: new Set<ExtendedLanguage>(['txt']),
  pendingLoads: new Map<ExtendedLanguage, Promise<void>>(),
  warnedLanguages: new Set<string>(),
}

// Normalize language to valid Shiki language
export async function normalizeLanguage(language?: string): Promise<ExtendedLanguage> {
  if (!language) return 'txt'

  const normalized = language.toLowerCase()
  const { bundledLanguages } = await loadShiki()

  if (normalized in bundledLanguages) {
    return normalized
  }

  if (normalized in languageAliases) {
    return languageAliases[normalized]
  }

  if (!state.warnedLanguages.has(language)) {
    console.warn(`[podlite] shiki unrecognized language '${language}', defaulting to [txt]`)
    state.warnedLanguages.add(language)
  }

  return 'txt'
}

// Get or create highlighter instance
async function getHighlighterInstance(): Promise<Highlighter> {
  if (!state.initPromise) {
    state.initPromise = (async () => {
      const { createHighlighter } = await loadShiki()
      const instance = await createHighlighter({
        themes: Object.values(CONFIG.themes),
        langs: CONFIG.initialLanguages,
      })
      state.instance = instance
      CONFIG.initialLanguages.forEach(lang => state.loadedLanguages.add(lang))
      return instance
    })()
  }
  return state.initPromise
}

// Load a language if not already loaded
async function ensureLanguageLoaded(instance: Highlighter, lang: ExtendedLanguage): Promise<void> {
  if (state.loadedLanguages.has(lang)) return

  let pending = state.pendingLoads.get(lang)
  if (!pending) {
    pending = instance
      .loadLanguage(lang)
      .then(() => {
        state.loadedLanguages.add(lang)
      })
      .finally(() => state.pendingLoads.delete(lang))

    state.pendingLoads.set(lang, pending)
  }

  await pending
}

// Main API: get highlighter with language loaded
export async function getHighlighter(language?: string): Promise<Highlighter> {
  const lang = await normalizeLanguage(language)
  const instance = await getHighlighterInstance()
  await ensureLanguageLoaded(instance, lang)
  return instance
}

// Convenience: convert code to HTML with dual themes (CSS-based switching)
export async function codeToHtml({ code, language }: { code: string; language: string }): Promise<string> {
  const lang = await normalizeLanguage(language)
  const highlighter = await getHighlighter(language)

  return highlighter.codeToHtml(code, {
    lang,
    themes: CONFIG.themes,
  })
}

// Convert code to HTML with explicit theme selection (for runtime theme detection)
export async function codeToThemedHtml({
  code,
  language,
  theme,
  decorations,
}: {
  code: string
  language: string
  theme?: 'light' | 'dark' | 'auto'
  decorations?: DecorationItem[]
}): Promise<string> {
  const lang = await normalizeLanguage(language)
  const highlighter = await getHighlighter(language)

  if (theme === 'light' || theme === 'dark') {
    return highlighter.codeToHtml(code, {
      lang,
      theme: CONFIG.themes[theme],
      decorations,
    })
  }

  return highlighter.codeToHtml(code, {
    lang,
    themes: CONFIG.themes,
    decorations,
  })
}

// Check if a language is loaded (sync — only meaningful after a prior async normalize)
export const isLanguageLoaded = (language: ExtendedLanguage): boolean => {
  return state.loadedLanguages.has(language)
}
