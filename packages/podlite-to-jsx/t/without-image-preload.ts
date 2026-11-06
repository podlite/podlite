// React 19 lifts a preload link of each image to the start of server markup; React 18 writes none
const LEADING_PRELOAD = /^<link rel="preload" as="image" href="([^"]*)"\/>/

export const withoutImagePreload = (html: string): string => {
  let rest = html
  for (let found = LEADING_PRELOAD.exec(rest); found; found = LEADING_PRELOAD.exec(rest)) {
    const after = rest.slice(found[0].length)
    if (!after.includes(`<img src="${found[1]}"`)) return rest
    rest = after
  }
  return rest
}
