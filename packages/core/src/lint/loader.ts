import * as fs from 'fs'
import * as path from 'path'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { PluginRegister as MarkdownRegister } from '@podlite/markdown'
import type { FileType } from './types'

const lintParser = podlitePluggable({ plugins: { ...MarkdownRegister } })

export function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.md' ? 'md' : 'podlite'
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

export function parseContent(content: string, fileType: FileType): PodliteDocument {
  return lintParser.parse(content, { podMode: fileType === 'md' ? 0 : 1 })
}
