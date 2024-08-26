import { PodNode } from '@podlite/schema'
import path from 'path'

// export const POSTS_PATH = path.join(process.cwd(), "/data")
export const POSTS_PATH = process.env.POSTS_PATH || path.join(process.cwd(), '/pub')
export const INDEX_PATH = process.env.INDEX_PATH || 'index.pod6'

export const BUILT_PATH = path.join(process.cwd(), '/built')
export const DATA_PATH = path.join(process.cwd(), '/built/data.json')
export const IMAGE_LIB = path.join(process.cwd(), '/built/images.ts')
export const COMPONENTS_LIB = path.join(process.cwd(), '/built/components.ts')
export const STYLES_LIB = path.join(process.cwd(), '/built/styles.css')

export const PAGES_FILE_PATH = path.join(process.cwd())
export const ASSETS_PATH = path.join(process.cwd(), '/public/assets')
export const PUBLIC_PATH = path.join(process.cwd(), '/public')

export type SiteInfo = {
  postsPerPage: 4
  favicon: string
  url: 'http://example.com'
  title: 'Example'
  globalStyles?: string
  node: PodNode
  footer: PodNode
  gtmId?: string // Google Tag Manager ID
  redirects: {
    source: string
    destination: string
    statusCode: number
  }[]
}

export const defaultIndexPage = `
=begin pod  
= :favicon<./favicon.png>
= :puburl<http://example.com>

=TITLE 📝 How to make a great post

=para 
Hey, this is a test page!


Powered by podlite.

=end pod
`
