// parse-css deno demo
import {parseAStylesheet} from '../index.js'
const ast = parseCSS.parseAStylesheet('div { color: lime }')

console.log(ast.toSource())
console.log(ast)