import { PodliteDocument, PodNode } from '@podlite/schema'

export type pubRecord = {
  type: string
  pubdate: string // '2024-08-02T12:34:56Z' ISO 8601, 'Tue, 02 Aug 2024 12:34:56 GMT' RFC 2822
  node: PodNode
  description?: PodNode
  file: string
}

export type publishRecord = pubRecord & {
  isPage?: boolean
  title: string | null
  publishUrl?: string | null
  sources: string[]
  node: PodliteDocument
  pubdate: string | undefined
  template?: publishRecord | null
  header?: PodNode | null
  footer?: PodNode | null
  subtitle?: string | null
  pluginsData?: { [name: string]: any }
  template_file?: string
}

// The record's `type` cannot answer this: it says whether the address was declared
// or built, and it is the letter the short url is made of. Only the author can call
// a document a page, with :type('page'); a document with no date is not published.
// An index written before isPage existed carries no answer at all; there the old
// field is still the best available one, and reading it keeps such a site as it was.
export const isEntry = (record: { pubdate?: string | null; isPage?: boolean; type?: string }): boolean =>
  Boolean(record.pubdate) && (record.isPage === undefined ? record.type !== 'page' : !record.isPage)
