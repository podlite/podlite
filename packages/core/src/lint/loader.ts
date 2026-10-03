import * as fs from 'fs'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { parseMd } from '@podlite/markdown'
import { formatOfFile } from '../file-format'
import { STDIN_NAME } from './types'
import type { FileType } from './types'

const podliteParser = podlitePluggable()

// text from the standard input has no name to tell its format by, and is Podlite
export function detectFileType(filePath: string): FileType {
  return filePath === STDIN_NAME ? 'podlite' : formatOfFile(filePath)
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

export function parseContent(content: string, fileType: FileType): PodliteDocument {
  if (fileType === 'md') {
    return parseMd(content) as unknown as PodliteDocument
  }
  return podliteParser.parse(content, { podMode: fileType === 'default' ? 0 : 1 })
}
