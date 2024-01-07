import { validateAst } from '../src';
// const describe = ( _ , f)=> f()
// const it = (_,  f) => f()
// const expect = (any):any=>{ 
//     const c=(any):any=>{}
//     c.toEqual = ()=>{}
//     return c
// }

describe('Check validateAst', () => {
  it('should ok for Test', () => {
    const r = validateAst({ters:"1"}, 'Test')
    expect(r).toEqual([])
  });
  it('should ok for simple PodNode', () => {
    const test = [
        {
          "type": "block",
          "content": [
                {
                  "type": "blankline"
                },
          ],
          "name": "pod",
          "margin": "",
          "config": [],
          "location": {
            "start": {
              "offset": 0,
              "line": 1,
              "column": 1
            },
            "end": {
              "offset": 82,
              "line": 10,
              "column": 1
            }
          }
        }
      ]
    const r = validateAst(test)
    expect(r).toEqual([])
  });


});
