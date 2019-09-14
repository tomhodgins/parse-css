// parse-css node demo
const parseCSS = require('../index.cjs.js')

const ast = parseCSS.parseAStylesheet('div { color: lime }')

console.log(ast.toSource())
console.log(ast)