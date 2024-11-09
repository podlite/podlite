import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const cacheBreadcrumb: { [key: string]: { title: string | null; publishUrl: string }[] } = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const getBreadcrumb = (url: string, recs: publishRecord[]) => {
    if (cacheBreadcrumb[url]) {
      return cacheBreadcrumb[url]
    }
    const currentCrumb: { title: string | null; publishUrl: string }[] = []

    const currentSlug = url.split('/').slice(1)
    if (currentSlug.length > 1) {
      const parentSlug = currentSlug.slice(0, -1)
      const parentUrl = '/' + parentSlug.join('/')
      currentCrumb.push(...getBreadcrumb(parentUrl, recs))
    }

    const selectedItem = recs.find(item => item.publishUrl === url)
    if (selectedItem) {
      currentCrumb.push({ title: selectedItem.title, publishUrl: selectedItem.publishUrl })
    }
    cacheBreadcrumb[url] = currentCrumb
    return currentCrumb
  }

  const onProcess = (recs: publishRecord[]) => {
    recs.forEach(item => {
      if (item.publishUrl) {
        const breadcrumb = getBreadcrumb(item.publishUrl, recs)
        item.pluginsData = item.pluginsData || {}
        item.pluginsData.breadcrumb = breadcrumb
      }
    })

    return recs
  }

  return [onProcess, onExit]
}

export default plugin
