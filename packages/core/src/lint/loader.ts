import * as fs from 'fs'
import * as path from 'path'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { parseMd } from '@podlite/markdown'
import type { FileType } from './types'

const podliteParser = podlitePluggable()

export function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.md' ? 'md' : 'podlite'
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

export function parseContent(content: string, fileType: FileType): PodliteDocument {
  if (fileType === 'md') {
    return parseMd(content) as unknown as PodliteDocument
  }
  return podliteParser.parse(content, { podMode: 1 })
}
