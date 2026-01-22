import {
  type BundledLanguage,
  type BundledTheme,
  createHighlighter,
  type Highlighter,
  bundledLanguages,
  bundledThemes,
} from 'shiki'

// Configuration
const CONFIG = {
  themes: {
    light: 'one-light' as BundledTheme,
    dark: 'github-dark' as BundledTheme,
  },
  initialLanguages: ['shell', 'txt'] as BundledLanguage[],
} as const

// Extend BundledLanguage to include 'txt'
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

// Singleton state
const state = {
  instance: null as Highlighter | null,
  initPromise: null as Promise<Highlighter> | null,
  loadedLanguages: new Set<ExtendedLanguage>(['txt']),
  pendingLoads: new Map<ExtendedLanguage, Promise<void>>(),
  warnedLanguages: new Set<string>(),
}

// Normalize language to valid Shiki language
export function normalizeLanguage(language?: string): ExtendedLanguage {
  if (!language) return 'txt'

  const normalized = language.toLowerCase()

  if (normalized in bundledLanguages) {
    return normalized as BundledLanguage
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
    state.initPromise = createHighlighter({
      // themes: Object.keys(bundledThemes) as BundledTheme[],
      themes: Object.values(CONFIG.themes)as BundledTheme[],
      langs: CONFIG.initialLanguages,
    }).then(instance => {
      state.instance = instance
      CONFIG.initialLanguages.forEach(lang => state.loadedLanguages.add(lang))
      return instance
    })
  }
  return state.initPromise
}

// Load a language if not already loaded
async function ensureLanguageLoaded(instance: Highlighter, lang: ExtendedLanguage): Promise<void> {
  if (state.loadedLanguages.has(lang)) return

  let pending = state.pendingLoads.get(lang)
  if (!pending) {
    pending = instance
      .loadLanguage(lang as BundledLanguage)
      .then(() => state.loadedLanguages.add(lang))
      .finally(() => state.pendingLoads.delete(lang))

    state.pendingLoads.set(lang, pending as Promise<void>)
  }

  await pending
}

// Main API: get highlighter with language loaded
export async function getHighlighter(language?: string): Promise<Highlighter> {
  const lang = normalizeLanguage(language)
  const instance = await getHighlighterInstance()
  await ensureLanguageLoaded(instance, lang)
  return instance
}

// Convenience: convert code to HTML with dual themes (CSS-based switching)
export async function codeToHtml({ code, language }: { code: string; language: string }): Promise<string> {
  const lang = normalizeLanguage(language)
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
}: {
  code: string
  language: string
  theme?: 'light' | 'dark' | 'auto'
}): Promise<string> {
  const lang = normalizeLanguage(language)
  const highlighter = await getHighlighter(language)

  // Single theme mode (for runtime detection)
  if (theme === 'light' || theme === 'dark') {
    return highlighter.codeToHtml(code, {
      lang,
      theme: CONFIG.themes[theme],
    })
  }

  // Dual theme mode (CSS-based switching)
  return highlighter.codeToHtml(code, {
    lang,
    themes: CONFIG.themes,
  })
}

// Check if a language is loaded
export const isLanguageLoaded = (language: string): boolean => {
  return state.loadedLanguages.has(normalizeLanguage(language))
}
