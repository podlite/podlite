const joinBase = (base: string, path: string): string => `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

export const applyImageBase = (src: string, base?: string): string => {
  if (!base || typeof src !== 'string' || src === '') return src
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/.exec(src)
  if (scheme) {
    if (scheme[1].toLowerCase() !== 'file') return src
    const rest = scheme[2]
    return rest.startsWith('/') ? src : joinBase(base, rest)
  }
  return src.startsWith('/') ? src : joinBase(base, src)
}
