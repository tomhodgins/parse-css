// parse-css node demo
const parseCSS = require('../index.cjs.js')

console.log(
  JSON.stringify(
    parseCSS.parseAStylesheet('div { color: lime }'),
    null,
    2
  )
)