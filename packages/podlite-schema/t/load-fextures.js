const fs = require('fs')
const glob = require('glob')
const allFixures = glob.sync('packages/podlite-schema/t/fixtures*.txt').map(f => {
  const testData = fs.readFileSync(f)
  const [text, json] = `${testData}`.split('~~~~~~~\n')
  const tree = JSON.parse(json)
  return { text, tree, file: f }
})

const allHtmlFixures = glob.sync('packages/podlite-schema/t/fixtures-html/*.txt').map(f => {
  const testData = fs.readFileSync(f)
  const [text, json] = `${testData}`.split('~~~~~~~\n')
  const tree = json // JSON.parse(json)
  return { text, tree, file: f }
})

module.exports = {
  allFixures,
  allHtmlFixures,
}
