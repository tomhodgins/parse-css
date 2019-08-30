# parse-css

A standards-based CSS parser

## About

- forked from the wonderful [tabatkins/parse-css](https://github.com/tabatkins/parse-css)
- aims to be a standards-compliant implementation of the [CSS Syntax Module](https://drafts.csswg.org/css-syntax) in JavaScript
- written in ES module format with ES6 JavaScript
- works in modern browsers (Chrome/Edge/Safari/Firefox) and [Deno](https://github.com/denoland/deno)

> Note: If you want a version of this written in ES5 JavaScript to use as a script in the browser (not as a module), or to use as a CommonJS module with Node, check out the original [tabatkins/parse-css](https://github.com/tabatkins/parse-css) which works beautifully in both of those environments.

## Usage

This package is delivered as an ES module. There are a few ways you can import the functions this package makes available depending on how you want to work with it.

### To import all functions

```js
import * as parseCSS from './index.js'

console.log(
  parseCSS.parseARule('div { color: lime; }')
)
```

### To import individual functions by name

```js
import {parseARule} from './index.js'

console.log(
  parseARule('div { color: lime; }')
)
```

> More information about JavaScript's `import` statement can be found on the Mozilla Developer Network: [MDN Web Docs: import - JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)

### Exported functions

The `tokenize()` function will tokenize any string given as input:

- `tokenize`

These functions correspond equivalent section in the CSS Syntax Module:

- `parseAStylesheet`
- `parseAListOfRules`
- `parseARule`
- `parseADeclaration`
- `parseAListOfDeclarations`
- `parseAComponentValue`
- `parseAListOfComponentValues`
- `parseACommaSeparatedListOfComponentValues`

## License

This project is released under [Creative Commons CC0](https://tldrlegal.com/license/creative-commons-cc0-1.0-universal).

## Thanks

Biggest thanks goes to [Tab Atkins Jr.](https://github.com/tabatkins), without whose original [parse-css](https://github.com/tabatkins/parse-css) this fork would not exist! After evaluating many different CSS parsing projects, only `parse-css` managed to parse CSS correctly. Thanks for your work on `parse-css` and your amazing contributions to CSS standardization and web standards.