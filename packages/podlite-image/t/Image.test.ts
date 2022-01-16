// import  * as Image  from '../src';
import { AstTree, isValidateError, PodliteDocument, validateAst} from '@podlite/schema'
import { podlite as podlite_core } from 'podlite'
import Image from '../src/index'

const parse = (str: string): PodliteDocument => {
    let podlite = podlite_core({ importPlugins: false }).use({ Image })
    let tree = podlite.parse(str)
    const asAst = podlite.toAst(tree)
    return asAst
}

const parseToHtml = (str: string): string => {
    let podlite = podlite_core({ importPlugins: false }).use({ Image })
    let tree = podlite.parse(str)
    const asAst = podlite.toAst(tree)
    return podlite.toHtml(asAst).toString()
}

const cleanHTML = (html: string) => {
    return html.replace(/\n+/g, '')
}

const FIXTURES = [
    [`=begin pod
=Image https://example.com/test.png
=end pod`,
        "<img src=\"https://example.com/test.png\"/>",
    '=Image url'
    ],

    [`=Image test`,
        "<img src=\"test\"/>",
    '=Image url'
    ],

    [`=Image alt text test`,
        "<img src=\"test\" alt=\"alt text\"/>",
    '=Image [alt] url'
    ],

    [`=for Image 
test`,
        "<img src=\"test\"/>"
    ],

]

describe("ast validator", () => {
    FIXTURES.map((i, idx) => test(`${i[2] || idx}`, () => {
        const pod = i[0]
        const result = parse(pod)
        const r = validateAst(result, 'PodliteDocument')
        const vres = isValidateError(r, result);
        expect(r).toEqual([]);
    }
    ))
})

describe("run parser tests", () => {
    FIXTURES.map((i, idx) => test(`${i[2] || idx}`, () => expect(cleanHTML(parseToHtml(i[0]))).toEqual(cleanHTML(i[1]))))
})
