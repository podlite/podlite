import { processFile } from '../src/node-utils'

const tctx = { testing: true }
const file1 = `
#=begin pod
#=end pod

`

it.skip('check parser', () => {
  const t1 = processFile('t/image-plugin/virtualFile.rakumod', file1)
  //   console.log(JSON.stringify(t1, null, 2))
})
