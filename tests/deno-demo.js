// parse-css deno demo
import {parseAStylesheet} from '../index.js'

console.log(
  JSON.stringify(
    parseAStylesheet('div { color: lime }'),
    null,
    2
  )
)