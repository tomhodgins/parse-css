// Parse CSS
// based on CSS Syntax Spec: https://drafts.csswg.org/css-syntax/
// homepage: https://github.com/tomhodgins/parse-css
// license: CC0
// authors: parse-css was originally written by Tab Atkins & contributors,
//   this version has been converted to ES6 and ES Module format by Tommy Hodgins (@innovati)
(
  (root, factory) => {
    typeof module === 'object' && module.exports
      ? module.exports = factory()
      : root.parseCSS = factory()
  }
)(
  typeof self !== 'undefined'
    ? self
    : this,
  () => {
    const donothing = _ => {}

    const char = (str = '') =>
      str.codePointAt(0)

    const between = (first = 0, num = 0, last = 0) =>
      first <= num && num <= last

    // https://drafts.csswg.org/css-syntax/#digit
    const digit = (code = 0) =>
      between(char('0'), code, char('9'))

    // https://drafts.csswg.org/css-syntax/#hex-digit
    const hexdigit = (code = 0) =>
      digit(code)
      || between(char('A'), code, char('F'))
      || between(char('a'), code, char('f'))

    // https://drafts.csswg.org/css-syntax/#uppercase-letter
    const uppercaseletter = (code = 0) =>
      between(char('A'), code, char('Z'))

    // https://drafts.csswg.org/css-syntax/#lowercase-letter
    const lowercaseletter = (code = 0) =>
      between(char('a'), code, char('z'))

    // https://drafts.csswg.org/css-syntax/#letter
    const letter = (code = 0) =>
      uppercaseletter(code)
      || lowercaseletter(code)

    // https://drafts.csswg.org/css-syntax/#non-ascii-code-point
    const nonascii = (code = 0) =>
      0x80 <= code

    // https://drafts.csswg.org/css-syntax/#name-start-code-point
    const namestartchar = (code = 0) =>
      letter(code)
      || nonascii(code)
      || code === char('_')

    // https://drafts.csswg.org/css-syntax/#name-code-point
    const namechar = (code = 0) =>
      namestartchar(code)
      || digit(code)
      || code === char('-')

    // https://drafts.csswg.org/css-syntax/#non-printable-code-point
    const nonprintable = (code = 0) =>
      between(0, code, 8)
      || code === 0xb
      || between(0xe, code, 0x1f)
      || code === 0x7f

    // https://drafts.csswg.org/css-syntax/#newline
    const newline = (code = 0) =>
      code === char('\n')

    // https://drafts.csswg.org/css-syntax/#whitespace
    const whitespace = (code = 0) =>
      newline(code)
      || code === char('\t')
      || code === char(' ')

    // Preprocessing the input stream
    // https://drafts.csswg.org/css-syntax/#input-preprocessing
    const preprocess = (str = '') => {
      const codepoints = []

      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i)

        if (
          code === char('\r')
          && str.charCodeAt(i + 1) === char('\n')
        ) {
          code = char('\n')
          i++
        }

        if (
          code === char('\r')
          || code === char('\f')
        ) {
          code = char('\n')
        }

        if (code === 0x0) {
          code = 0xfffd
        }

        if (
          between(0xd800, code, 0xdbff)
          && between(0xdc00, str.charCodeAt(i + 1), 0xdfff)
        ) {
          // Decode a surrogate pair into an astral codepoint
          const lead = code - 0xd800
          const trail = str.charCodeAt(i + 1) - 0xdc00

          code = Math.pow(2, 20) + lead * Math.pow(2, 10) + trail
          i++
        }

        codepoints.push(code)
      }

      return codepoints
    }

    // Tokenization
    const stringFromCode = (code = 0) => {
      if (code <= 0xffff) {
        return String.fromCharCode(code)
      }

      // Otherwise, encode astral char as surrogate pair
      code -= Math.pow(2, 20)

      const lead = Math.floor(code / Math.pow(2, 10)) + 0xd800
      const trail = code % Math.pow(2, 10) + 0xdc00

      return String.fromCharCode(lead) + String.fromCharCode(trail)
    }

    // https://drafts.csswg.org/css-syntax/#tokenization
    const tokenize = (str = '') => {
      str = preprocess(str)

      let i = -1
      const tokens = []
      const maximumallowedcodepoint = 0x10ffff
      let code

      // Line number information
      let line = 0
      let column = 0

      // The only use of lastLineLength is in reconsume()
      let lastLineLength = 0

      const incrLineno = () => {
        line += 1
        lastLineLength = column
        column = 0
      }

      const locStart = {line, column}

      const codepoint = i => {
        if (str.length <= i) {
          return -1
        }

        return str[i]
      }

      const next = num => {
        if (num === undefined) {
          num = 1
        }

        if (3 < num) {
          throw 'Spec Error: no more than three codepoints of lookahead.'
        }

        return codepoint(i + num)
      }

      const consume = num => {
        if (num === undefined) {
          num = 1
        }

        i += num
        code = codepoint(i)

        if (newline(code)) {
          incrLineno()
        } else {
          column += num
        }

        return true
      }

      const reconsume = () => {
        i -= 1

        if (newline(code)) {
          line -= 1
          column = lastLineLength
        } else {
          column -= 1
        }

        locStart.line = line
        locStart.column = column
        return true
      }

      const eof = codepoint => {
        if (codepoint === undefined) {
          codepoint = code
        }

        return codepoint === -1
      }

      const parseerror = () => {
        console.log(`Parse error at index ${i}, processing codepoint 0x${code.toString(16)}.`)
        return true
      }

      // https://drafts.csswg.org/css-syntax/#consume-token
      const consumeAToken = () => {
        consumeComments()
        consume()

        if (whitespace(code)) {
          while (whitespace(next())) {
            consume()
          }

          return new WhitespaceToken
        }

        else if (code === char('"')) {
          return consumeAStringToken()
        }

        else if (code === char('#')) {
          if (
            namechar(next())
            || areAValidEscape(next(1), next(2))
          ) {
            const token = new HashToken()

            if (wouldStartAnIdentifier(next(1), next(2), next(3))) {
              token.type = 'id'
            }

            token.value = consumeAName()
            return token
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('$')) {
          if (next() === char('=')) {
            consume()
            return new SuffixMatchToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char("'")) {
          return consumeAStringToken()
        }

        else if (code === char('(')) {
          return new OpenParenToken()
        }

        else if (code === char(')')) {
          return new CloseParenToken()
        }

        else if (code === char('*')) {
          if (next() === char('=')) {
            consume()
            return new SubstringMatchToken()
          }
          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('+')) {
          if (startsWithANumber()) {
            reconsume()
            return consumeANumericToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char(',')) {
          return new CommaToken()
        }

        else if (code === char('-')) {
          if (startsWithANumber()) {
            reconsume()
            return consumeANumericToken()
          }

          else if (
            next(1) === char('-')
            && next(2) === char('>')
          ) {
            consume(2)
            return new CDCToken()
          }

          else if (startsWithAnIdentifier()) {
            reconsume()
            return consumeAnIdentlikeToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('.')) {
          if (startsWithANumber()) {
            reconsume()
            return consumeANumericToken()
          }
          else {
            return new DelimToken(code)
          }
        }

        else if (code === char(':')) {
          return new ColonToken
        }

        else if (code === char(';')) {
          return new SemicolonToken
        }

        else if (code === char('<')) {
          if (
            next(1) === char('!')
            && next(2) === char('-')
            && next(3) === char('-')
          ) {
            consume(3)
            return new CDOToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('@')) {
          if (wouldStartAnIdentifier(next(1), next(2), next(3))) {
            return new AtKeywordToken(consumeAName())
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('[')) {
          return new OpenSquareToken()
        }

        else if (code === char('\\')) {
          if (startsWithAValidEscape()) {
            reconsume()
            return consumeAnIdentlikeToken()
          }

          else {
            parseerror()
            return new DelimToken(code)
          }
        }

        else if (code === char(']')) {
          return new CloseSquareToken()
        }

        else if (code === char('^')) {
          if (next() === char('=')) {
            consume()
            return new PrefixMatchToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('{')) {
          return new OpenCurlyToken()
        }

        else if (code === char('|')) {
          if (next() === char('=')) {
            consume()
            return new DashMatchToken()
          }

          else if (next() === char('|')) {
            consume()
            return new ColumnToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (code === char('}')) {
          return new CloseCurlyToken()
        }

        else if (code === char('~')) {
          if (next() === char('=')) {
            consume()
            return new IncludeMatchToken()
          }

          else {
            return new DelimToken(code)
          }
        }

        else if (digit(code)) {
          reconsume()
          return consumeANumericToken()
        }

        else if (namestartchar(code)) {
          reconsume()
          return consumeAnIdentlikeToken()
        }

        else if (eof()) {
          return new EOFToken()
        }

        else {
          return new DelimToken(code)
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-comment
      const consumeComments = () => {
        while (
          next(1) === char('/')
          && next(2) === char('*')
        ) {
          consume(2)

          while (true) {
            consume()
            if (
              code === char('*')
              && next() === char('/')
            ) {
              consume()
              break
            }

            else if (eof()) {
              parseerror()
              return
            }
          }
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-numeric-token
      const consumeANumericToken = () => {
        const num = consumeANumber()

        if (wouldStartAnIdentifier(next(1), next(2), next(3))) {
          const token = new DimensionToken()

          token.value = num.value
          token.repr = num.repr
          token.type = num.type
          token.unit = consumeAName()
          return token
        }

        else if (next() === char('%')) {
          consume()
          const token = new PercentageToken()

          token.value = num.value
          token.repr = num.repr
          return token
        }

        else {
          const token = new NumberToken()

          token.value = num.value
          token.repr = num.repr
          token.type = num.type
          return token
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-ident-like-token
      const consumeAnIdentlikeToken = () => {
        const str = consumeAName()

        if (
          str.toLowerCase() === 'url'
          && next() === char('(')
        ) {
          consume()

          while (
            whitespace(next(1))
            && whitespace(next(2))
          )  {
            consume()
          }

          if (
            next() === char('"')
            || next() === char("'")
          ) {
            return new FunctionToken(str)
          }

          else if (
            whitespace(next())
            && (
              next(2) === char('"')
              || next(2) === char("'")
            )
          ) {
            return new FunctionToken(str)
          }

          else {
            return consumeAURLToken()
          }
        }

        else if (next() === char('(')) {
          consume()
          return new FunctionToken(str)
        }

        else {
          return new IdentToken(str)
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-string-token
      const consumeAStringToken = endingCodePoint => {
        if (endingCodePoint === undefined) {
          endingCodePoint = code
        }

        let str = ''

        while (consume()) {
          if (
            code === endingCodePoint
            || eof()
          ) {
            return new StringToken(str)
          }

          else if (newline(code)) {
            parseerror()
            reconsume()
            return new BadStringToken()
          }

          else if (code === char('\\')) {
            if (eof(next())) {
              donothing()
            }

            else if (newline(next())) {
              consume()
            }

            else {
              str += stringFromCode(consumeEscape())
            }
          }

          else {
            str += stringFromCode(code)
          }
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-url-token
      const consumeAURLToken = () => {
        const token = new URLToken('')

        while (whitespace(next())) {
          consume()
        }

        if (eof(next())) {
          return token
        }

        while (consume()) {
          if (
            code === char(')')
            || eof()
          ) {
            return token
          }

          else if (whitespace(code)) {
            while (whitespace(next())) {
              consume()
            }

            if (
              next() === char(')')
              || eof(next())
            ) {
              consume()
              return token
            }

            else {
              consumeTheRemnantsOfABadURL()
              return new BadURLToken()
            }
          }

          else if (
            code === char('"')
            || code === char("'")
            || code === char('(')
            || nonprintable(code)
          ) {
            parseerror()
            consumeTheRemnantsOfABadURL()
            return new BadURLToken()
          }

          else if (code === char('\\')) {
            if (startsWithAValidEscape()) {
              token.value += stringFromCode(consumeEscape())
            }

            else {
              parseerror()
              consumeTheRemnantsOfABadURL()
              return new BadURLToken()
            }
          }

          else {
            token.value += stringFromCode(code)
          }
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-escaped-code-point
      const consumeEscape = () => {
        // Assume the the current character is the \
        // and the next code point is not a newline
        consume()

        if (hexdigit(code)) {
          // Consume 1-6 hex digits
          const digits = [code]

          for (let total = 0; total < 5; total++) {
            if (hexdigit(next())) {
              consume()
              digits.push(code)
            }

            else {
              break
            }
          }

          if (whitespace(next())) {
            consume()
          }

          let value = parseInt(
            digits.map(x => String.fromCharCode(x)).join(''),
            16
          )

          if (maximumallowedcodepoint < value) {
            value = 0xfffd
          }

          return value
        }

        else if (eof()) {
          return 0xfffd
        }

        else {
          return code
        }
      }

      const areAValidEscape = (c1, c2) => {
        if (c1 !== char('\\')) {
          return false
        }

        if (newline(c2)) {
          return false
        }

        return true
      }

      // https://drafts.csswg.org/css-syntax/#starts-with-a-valid-escape
      const startsWithAValidEscape = () =>
        areAValidEscape(code, next())

      // https://drafts.csswg.org/css-syntax/#would-start-an-identifier
      const wouldStartAnIdentifier = (c1, c2, c3) => {
        if (c1 === char('-')) {
          return namestartchar(c2)
            || c2 === char('-')
            || areAValidEscape(c2, c3)
        }

        else if (namestartchar(c1)) {
          return true
        }

        else if (c1 === char('\\')) {
          return areAValidEscape(c1, c2)
        }

        else {
          return false
        }
      }

      const startsWithAnIdentifier = () =>
        wouldStartAnIdentifier(code, next(1), next(2))

      // https://drafts.csswg.org/css-syntax/#starts-with-a-number
      const wouldStartANumber = (c1, c2, c3) => {
        if (
          c1 === char('+')
          || c1 === char('-')
        ) {
          if (digit(c2)) {
            return true
          }

          if (
            c2 === char('.')
            && digit(c3)
          )  {
            return true
          }

          return false
        }

        else if (c1 === char('.')) {
          if (digit(c2)) {
            return true
          }

          return false
        }

        else if (digit(c1)) {
          return true
        }

        else {
          return false
        }
      }

      const startsWithANumber = () => wouldStartANumber(code, next(1), next(2))

      // https://drafts.csswg.org/css-syntax/#consume-name
      const consumeAName = () => {
        let result = ''

        while (consume()) {
          if (namechar(code)) {
            result += stringFromCode(code)
          }

          else if (startsWithAValidEscape()) {
            result += stringFromCode(consumeEscape())
          }

          else {
            reconsume()
            return result
          }
        }
      }

      // https://drafts.csswg.org/css-syntax/#consume-number
      const consumeANumber = () => {
        let repr = []
        let type = 'integer'

        if (
          next() === char('+')
          || next() === char('-')
        ) {
          consume()
          repr += stringFromCode(code)
        }

        while (digit(next())) {
          consume()
          repr += stringFromCode(code)
        }

        if (
          next(1) === char('.')
          && digit(next(2))
        ) {
          consume()
          repr += stringFromCode(code)
          consume()
          repr += stringFromCode(code)

          type = 'number'

          while (digit(next())) {
            consume()
            repr += stringFromCode(code)
          }
        }

        const c1 = next(1)
        const c2 = next(2)
        const c3 = next(3)

        if (
          (
            c1 === char('E')
            || c1 === char('e')
          )
          && digit(c2)
        ) {
          consume()
          repr += stringFromCode(code)
          consume()
          repr += stringFromCode(code)

          type = 'number'

          while (digit(next())) {
            consume()
            repr += stringFromCode(code)
          }
        }

        else if (
          (
            c1 === char('E')
            || c1 === char('e')
          )
          && (
            c2 === char('+')
            || c2 === char('-')
          )
          && digit(c3)
        ) {
          consume()
          repr += stringFromCode(code)
          consume()
          repr += stringFromCode(code)
          consume()
          repr += stringFromCode(code)

          type = 'number'

          while (digit(next())) {
            consume()
            repr += stringFromCode(code)
          }
        }

        const value = convertAStringToANumber(repr)

        return {type, value, repr}
      }

      // https://drafts.csswg.org/css-syntax/#convert-string-to-number
      const convertAStringToANumber = (str = '') => +str

      // https://drafts.csswg.org/css-syntax/#consume-remnants-of-bad-url
      const consumeTheRemnantsOfABadURL = () => {
        while (consume()) {
          if (
            code === char(')')
            || eof()
          ) {
            return
          }

          else if (startsWithAValidEscape()) {
            consumeEscape()
            donothing()
          }

          else {
            donothing()
          }
        }
      }

      let iterationCount = 0

      while (!eof(next())) {
        tokens.push(consumeAToken())
        iterationCount++

        if (str.length * 2 < iterationCount) {
          return 'I’m infinite-looping!'
        }
      }

      return tokens
    }

    // Token objects
    class CSSParserToken {
      constructor() {
        if (this.constructor === CSSParserToken) {
          throw new Error(`Can't instantiate abstract class`)
        }
      }
      toJSON() { return {token: this.tokenType} }
      toString() { return this.tokenType }
      toSource() { return '' + this }
    }

    class StringValuedToken extends CSSParserToken {
      constructor() {
        super()

        if (this.constructor === StringValuedToken) {
          throw new Error(`Can't instantiate abstract class`)
        }
      }
      ASCIIMatch(string = '') { return this.value.toLowerCase() === string.toLowerCase() }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value
        }
      }
    }

    class GroupingToken extends CSSParserToken {
      constructor() {
        super()

        if (this.constructor === CSSParserToken) {
          throw new Error(`Can't instantiate abstract class`)
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-ident-token
    class IdentToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'IDENT'
        this.value = value
      }
      toString() { return `IDENT(${this.value})` }
      toSource() { return escapeIdent(this.value) }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-function-token
    class FunctionToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'FUNCTION'
        this.mirror = ')'
        this.value = value
      }
      toString() { return `FUNCTION(${this.value})` }
      toSource() { return escapeIdent(this.value) + '(' }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-at-keyword-token
    class AtKeywordToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'AT-KEYWORD'
        this.value = value
      }
      toString() { return `AT(${this.value})` }
      toSource() { return '@' + escapeIdent(this.value) }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-hash-token
    class HashToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'HASH'
        this.type = 'unrestricted'
        this.value = value
      }
      toString() { return `HASH(${this.value})` }
      toSource() {
        if (this.type === 'id') {
          return '#' + escapeIdent(this.value)
        }

        else {
          return '#' + escapeHash(this.value)
        }
      }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value,
          type: this.type
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-string-token
    class StringToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'STRING'
        this.value = value
      }
      toString() { return `"${escapeString(this.value)}"` }
      toSource() { return `"${escapeString(this.value)}"` }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-bad-string-token
    class BadStringToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'BADSTRING'
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-url-token
    class URLToken extends StringValuedToken {
      constructor(value) {
        super()

        this.tokenType = 'URL'
        this.value = value
      }
      toString() { return `URL(${this.value})` }
      toSource() { return `url("${escapeString(this.value)}")` }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-bad-url-token
    class BadURLToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'BADURL'
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-delim-token
    class DelimToken extends CSSParserToken {
      constructor(value) {
        super()

        this.tokenType = 'DELIM'
        this.value = stringFromCode(value)
      }
      toString() { return `DELIM(${this.value})` }
      toSource() {
        if (this.value === '\\') {
          return '\\\n'
        }

        else {
          return this.value
        }
      }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-number-token
    class NumberToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'NUMBER'
        this.value = null
        this.type = 'integer'
        this.repr = ''
      }
      toString() {
        if (this.type === 'integer') {
          return `INT(${this.value})`
        }

        return `NUMBER(${this.value})`
      }
      toSource() { return this.repr }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value,
          type: this.type,
          repr: this.repr
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-percentage-token
    class PercentageToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'PERCENTAGE'
        this.value = null
        this.repr = ''
      }
      toString() { return `PERCENTAGE(${this.value})` }
      toSource() { return this.repr + '%' }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value,
          repr: this.repr
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-dimension-token
    class DimensionToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'DIMENSION'
        this.value = null
        this.type = 'integer'
        this.repr = ''
        this.unit = ''
      }
      toString() {
        const source = this.repr
        let unit = escapeIdent(this.unit)

        if (
          unit[0].toLowerCase() === 'e'
          && (
            unit[1] === '-'
            || digit(unit.charCodeAt(1))
          )
        ) {
          // Unit is ambiguous with scientific notation
          // Remove the leading "e", replace with escape
          unit = '\\65 ' + unit.slice(1, unit.length)
        }

        return source + unit
      }
      toSource() { return `${String(this.value).replace(/0+\./, '.')}${this.unit}` }
      toJSON() {
        return {
          ...super.toJSON(),
          value: this.value,
          type: this.type,
          repr: this.repr,
          unit: this.unit
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-whitespace-token
    class WhitespaceToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'WHITESPACE'
      }
      toString() { return 'WS' }
      toSource() { return ' ' }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-cdo-token
    class CDOToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'CDO'
      }
      toSource() { return '<!--' }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-cdc-token
    class CDCToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'CDC'
      }

      toSource() { return '-->' }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-colon-token
    class ColonToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = ':'
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-semicolon-token
    class SemicolonToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = ';'
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-comma-token
    class CommaToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = ','
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-open-square
    class OpenSquareToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = '['
        this.value = '['
        this.mirror = ']'
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-close-square
    class CloseSquareToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = ']'
        this.value = ']'
        this.mirror = '['
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-open-paren
    class OpenParenToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = '('
        this.value = '('
        this.mirror = ')'
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-close-paren
    class CloseParenToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = ')'
        this.value = ')'
        this.mirror = '('
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-open-curly
    class OpenCurlyToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = '{'
        this.value = '{'
        this.mirror = '}'
      }
    }

    // https://drafts.csswg.org/css-syntax/#tokendef-close-curly
    class CloseCurlyToken extends GroupingToken {
      constructor() {
        super()

        this.tokenType = '}'
        this.value = '}'
        this.mirror = '{'
      }
    }

    // https://drafts.csswg.org/selectors-4/#attribute-representation
    class IncludeMatchToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '~='
      }
    }

    class DashMatchToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '|='
      }
    }

    // https://drafts.csswg.org/selectors-4/#attribute-substrings
    class PrefixMatchToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '^='
      }
    }

    class SuffixMatchToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '$='
      }
    }

    class SubstringMatchToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '*='
      }
    }

    // https://drafts.csswg.org/selectors-4/#the-column-combinator
    class ColumnToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = '||'
      }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-eof-token
    class EOFToken extends CSSParserToken {
      constructor() {
        super()

        this.tokenType = 'EOF'
      }
      toSource() { return '' }
    }

    // Escaping functions
    class InvalidCharacterError extends Error {
      constructor(value) {
        this.message = value
        this.name = 'InvalidCharacterError'
      }
    }

    const escapeIdent = (str = '') => {
      str = '' + str

      let result = ''
      const firstcode = str.charCodeAt(0)

      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)

        if (code === 0x0) {
          throw new InvalidCharacterError('Invalid character: the input contains U+0000.')
        }

        if (
          between(0x1, code, 0x1f)
          || code === 0x7f
          || (
            i === 0
            && digit(code)
          )
          || (
            i === 1
            && digit(code)
            && firstcode === char('-')
          )
        ) {
          result += '\\' + code.toString(16) + ' '
        }

        else if (
          0x80 <= code
          || code === char('-')
          || code === char('_')
          || digit(code)
          || letter(code)
        ) {
          result += str[i]
        }

        else {
          result += '\\' + str[i]
        }
      }

      return result
    }

    const escapeHash = (str = '') => {
      // Escapes the contents of "unrestricted"-type hash tokens
      // Won't preserve the ID-ness of "id"-type hash tokens;
      // use escapeIdent() for that
      str = '' + str

      let result = ''

      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)

        if (code === 0x0) {
          throw new InvalidCharacterError('Invalid character: the input contains U+0000.')
        }

        if (
          0x80 <= code
          || code === char('-')
          || code === char('_')
          || digit(code)
          || letter(code)
        ) {
          result += str[i]
        }

        else {
          result += '\\' + code.toString(16) + ' '
        }
      }

      return result
    }

    const escapeString = (str = '') => {
      str = '' + str

      let result = ''

      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)

        if (code === 0x0) {
          throw new InvalidCharacterError('Invalid character: the input contains U+0000.')
        }

        if (
          between(0x1, code, 0x1f)
          || code === 0x7f
        ) {
          result += '\\' + code.toString(16) + ' '
        }

        else if (
          code === char('"')
          || code === char('\\')
        ) {
          result += '\\' + str[i]
        }

        else {
          result += str[i]
        }
      }

      return result
    }

    // Token stream
    class TokenStream {
      constructor(value = []) {
        this.tokens = value
        this.i = -1
      }
      tokenAt(i) {
        if (i < this.tokens.length) {
          return this.tokens[i]
        }

        return new EOFToken()
      }
      consume(num) {
        if (num === undefined) {
          num = 1
        }

        this.i += num
        this.token = this.tokenAt(this.i)

        return true
      }
      next() { return this.tokenAt(this.i + 1) }
      reconsume() { this.i-- }
    }

    const parseerror = (s, msg) => {
      console.log(`Parse error at token ${s.i}: ${s.token}.\n${msg}`)
      return true
    }

    // https://drafts.csswg.org/css-syntax/#consume-list-of-rules
    const consumeAListOfRules = (str, topLevel) => {
      let rules = []
      let rule

      while (str.consume()) {
        if (str.token instanceof WhitespaceToken) {
          continue
        }

        else if (str.token instanceof EOFToken) {
          return rules
        }

        else if (
          str.token instanceof CDOToken
          || str.token instanceof CDCToken
        ) {
          if (topLevel === 'top-level') {
            continue
          }

          str.reconsume()

          if (rule = consumeAQualifiedRule(str)) {
            rules.push(rule)
          }
        }

        else if (str.token instanceof AtKeywordToken) {
          str.reconsume()

          if (rule = consumeAnAtRule(str)) {
            rules.push(rule)
          }
        }

        else {
          str.reconsume()

          if (rule = consumeAQualifiedRule(str)) {
            rules.push(rule)
          }
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#consume-at-rule
    const consumeAnAtRule = (str = '') => {
      str.consume()
      const rule = new AtRule(str.token.value)

      while (str.consume()) {
        if (
          str.token instanceof SemicolonToken
          || str.token instanceof EOFToken
        ) {
          return rule
        }

        else if (str.token instanceof OpenCurlyToken) {
          rule.value = consumeASimpleBlock(str)
          return rule
        }

        else if (
          str.token instanceof SimpleBlock
          && str.token.name === '{'
        ) {
          rule.value = str.token

          return rule
        }

        else {
          str.reconsume()
          rule.prelude.push(consumeAComponentValue(str))
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#consume-qualified-rule
    const consumeAQualifiedRule = (str = '') => {
      const rule = new QualifiedRule()
      while (str.consume()) {
        if (str.token instanceof EOFToken) {
          parseerror(str, 'Hit EOF when trying to parse the prelude of a qualified rule.')
          return
        }

        else if (str.token instanceof OpenCurlyToken) {
          rule.value = consumeASimpleBlock(str)
          return rule
        }

        else if (
          str.token instanceof SimpleBlock
          && str.token.name === '{'
        ) {
          rule.value = str.token
          return rule
        }

        else {
          str.reconsume()
          rule.prelude.push(consumeAComponentValue(str))
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#consume-list-of-declarations
    const consumeAListOfDeclarations = (str = '') => {
      let decls = []

      while (str.consume()) {
        if (
          str.token instanceof WhitespaceToken
          || str.token instanceof SemicolonToken
        ) {
          donothing()
        }

        else if (str.token instanceof EOFToken) {
          return decls
        }

        else if (str.token instanceof AtKeywordToken) {
          str.reconsume()
          decls.push(consumeAnAtRule(str))
        }

        else if (str.token instanceof IdentToken) {
          let temp = [str.token]

          while (
            !(
              str.next() instanceof SemicolonToken
              || str.next() instanceof EOFToken
            )
          ) {
            temp.push(consumeAComponentValue(str))
          }

          let decl

          if (decl = consumeADeclaration(new TokenStream(temp))) {
            decls.push(decl)
          }
        }

        else {
          parseerror(str)
          str.reconsume()

          while (
            !(
              str.next() instanceof SemicolonToken
              || str.next() instanceof EOFToken
            )
          ) {
            consumeAComponentValue(str)
          }
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#consume-declaration
    const consumeADeclaration = (str = '') => {
      // Assumes that the next input token will be an ident token
      str.consume()

      const decl = new Declaration(str.token.value)

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (!(str.next() instanceof ColonToken)) {
        parseerror(str)
        return
      }

      else {
        str.consume()
      }

      while (!(str.next() instanceof EOFToken)) {
        decl.value.push(consumeAComponentValue(str))
      }

      let foundImportant = false

      for (let i = decl.value.length - 1; 0 <= i; i--) {
        if (decl.value[i] instanceof WhitespaceToken) {
          continue
        }

        else if (
          decl.value[i] instanceof IdentToken
          && decl.value[i].ASCIIMatch('important')
        ) {
          foundImportant = true
        }

        else if (
          foundImportant
          && decl.value[i] instanceof DelimToken
          && decl.value[i].value === '!'
        ) {
          decl.value.splice(i, decl.value.length)
          decl.important = true

          break
        }

        else {
          break
        }
      }

      return decl
    }

    // https://drafts.csswg.org/css-syntax/#consume-component-value
    const consumeAComponentValue = (str = '') => {
      str.consume()

      if (
        str.token instanceof OpenCurlyToken
        || str.token instanceof OpenSquareToken
        || str.token instanceof OpenParenToken
      ) {
        return consumeASimpleBlock(str)
      }

      if (str.token instanceof FunctionToken) {
        return consumeAFunction(str)
      }

      return str.token
    }

    // https://drafts.csswg.org/css-syntax/#consume-simple-block
    const consumeASimpleBlock = (str = '') => {
      const mirror = str.token.mirror
      const block = new SimpleBlock(str.token.value)

      while (str.consume()) {
        if (
          str.token instanceof EOFToken
          || (
            str.token instanceof GroupingToken
            && str.token.value === mirror
          )
        ) {
          return block
        }

        else {
          str.reconsume()
          block.value.push(consumeAComponentValue(str))
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#consume-function
    const consumeAFunction = (str = '') => {
      const func = new Func(str.token.value)

      while (str.consume()) {
        if (
          str.token instanceof EOFToken
          || str.token instanceof CloseParenToken
        ) {
          return func
        }

        else {
          str.reconsume()
          func.value.push(consumeAComponentValue(str))
        }
      }
    }

    const normalizeInput = input => {
      if (typeof input === 'string') {
        return new TokenStream(tokenize(input))
      }

      if (input instanceof TokenStream) {
        return input
      }

      if (input.length !== undefined) {
        return new TokenStream(input)
      }

      else {
        throw SyntaxError(input)
      }
    }

    // https://drafts.csswg.org/css-syntax/#parse-stylesheet
    const parseAStylesheet = (str = '') => {
      str = normalizeInput(str)
      const stylesheet = new Stylesheet()
      stylesheet.value = consumeAListOfRules(str, 'top-level')

      return stylesheet
    }

    // https://drafts.csswg.org/css-syntax/#parse-list-of-rules
    const parseAListOfRules = (str = '') => {
      str = normalizeInput(str)
      return consumeAListOfRules(str)
    }

    // https://drafts.csswg.org/css-syntax/#parse-rule
    const parseARule = (str = '') => {
      str = normalizeInput(str)
      let rule

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (str.next() instanceof EOFToken) {
        throw SyntaxError()
      }

      if (str.next() instanceof AtKeywordToken) {
        rule = consumeAnAtRule(str)
      }

      else {
        rule = consumeAQualifiedRule(str)
        if (!rule) {
          throw SyntaxError()
        }
      }

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (str.next() instanceof EOFToken) {
        return rule
      }

      throw SyntaxError()
    }

    // https://drafts.csswg.org/css-syntax/#parse-declaration
    const parseADeclaration = (str = '') => {
      str = normalizeInput(str)

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (!(str.next() instanceof IdentToken)) {
        throw SyntaxError()
      }

      const decl = consumeADeclaration(str)

      if (decl) {
        return decl
      }

      else {
        throw SyntaxError()
      }
    }

    // https://drafts.csswg.org/css-syntax/#parse-list-of-declarations
    const parseAListOfDeclarations = (str = '') => {
      str = normalizeInput(str)
      return consumeAListOfDeclarations(str)
    }

    // https://drafts.csswg.org/css-syntax/#parse-component-value
    const parseAComponentValue = (str = '') => {
      str = normalizeInput(str)

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (str.next() instanceof EOFToken) {
        throw SyntaxError()
      }

      const val = consumeAComponentValue(str)

      if (!val) {
        throw SyntaxError()
      }

      while (str.next() instanceof WhitespaceToken) {
        str.consume()
      }

      if (str.next() instanceof EOFToken) {
        return val
      }

      throw SyntaxError()
    }

    // https://drafts.csswg.org/css-syntax/#parse-list-of-component-values
    const parseAListOfComponentValues = (str = '') => {
      str = normalizeInput(str)

      let vals = []

      while (true) {
        const val = consumeAComponentValue(str)
        if (val instanceof EOFToken) {
          return vals
        }

        else {
          vals.push(val)
        }
      }
    }

    // https://drafts.csswg.org/css-syntax/#parse-comma-separated-list-of-component-values
    const parseACommaSeparatedListOfComponentValues = (str = '') => {
      str = normalizeInput(str)

      let listOfCVLs = []

      while (true) {
        let vals = []

        while (true) {
          const val = consumeAComponentValue(str)

          if (val instanceof EOFToken) {
            listOfCVLs.push(vals)
            return listOfCVLs
          }

          else if (val instanceof CommaToken) {
            listOfCVLs.push(vals)
            break
          }

          else {
            vals.push(val)
          }
        }
      }
    }

    // Parser objects
    const flattenTokens = (tokens = [], joinString = '') => {
      if (
        Array.isArray(tokens)
      ) {
        return tokens
          .map(token => token.toSource())
          .join(joinString)
      } else if (!tokens) {
        return ';'
      } else {
        try {
          return tokens.toSource()
        } catch (error) {
          console.log(tokens, error)
          return 'error'
        }
      }
    }

    class CSSParserRule {
      constructor () {
        if (this.constructor === CSSParserRule) {
          throw new Error("Can't instantiate abstract class");
        }
      }
      toString(value) { return JSON.stringify(this, null, value) }
      toJSON() { return {type: this.type, value: this.value} }
      toSource() { return this.value }
    }

    // https://drafts.csswg.org/css-syntax/#typedef-stylesheet
    class Stylesheet extends CSSParserRule {
      constructor() {
        super()

        this.type = 'STYLESHEET'
        this.value = []
      }
      toSource() { return flattenTokens(this.value, ' ').trim() }
    }

    // https://drafts.csswg.org/css-syntax/#at-rule
    class AtRule extends CSSParserRule {
      constructor(value) {
        super()

        this.type = 'AT-RULE'
        this.name = value
        this.prelude = []
        this.value = null
      }
      toJSON() {
        return {
          ...super.toJSON(),
          name: this.name,
          prelude: this.prelude
        }
      }
      toSource() {
        return `@${this.name}${flattenTokens(this.prelude)}${flattenTokens(this.value)}`
      }
    }

    // https://drafts.csswg.org/css-syntax/#qualified-rule
    class QualifiedRule extends CSSParserRule {
      constructor() {
        super()

        this.type = 'QUALIFIED-RULE'
        this.prelude = []
        this.value = []
      }
      toJSON() {
        return {
          ...super.toJSON(),
          prelude: this.prelude
        }
      }
      toSource() {
        return `${flattenTokens(this.prelude)}${flattenTokens(this.value)}`
      }
    }

    // https://drafts.csswg.org/css-syntax/#declaration
    class Declaration extends CSSParserRule {
      constructor(value) {
        super()

        this.type = 'DECLARATION'
        this.name = value
        this.value = []
        this.important = false
      }
      toJSON() {
        return {
          ...super.toJSON(),
          name: this.name,
          important: this.important
        }
      }
      toSource() {
        return `${this.name}:${flattenTokens(this.value)}${this.important ? `!important` : ''}`
      }
    }

    class SimpleBlock extends CSSParserRule {
      constructor(value) {
        super()

        this.type = 'BLOCK'
        this.name = value
        this.value = []
        this.mirror = ({
          '(': ')',
          '{': '}',
          '[': ']'
        })[this.name]
      }
      toJSON() {
        return {
          ...super.toJSON(),
          name: this.name
        }
      }
      toSource() {
        return `${this.name}${this.value.map(token => token.toSource()).join('')}${this.mirror}`
      }
    }

    class Func extends CSSParserRule {
      constructor(value) {
        super()

        this.type = 'FUNCTION'
        this.name = value
        this.value = []
      }
      toJSON() {
        return {
          ...super.toJSON(),
          name: this.name
        }
      }
      toSource() {
        return `${this.name}(${this.value.map(token => token.toSource()).join('')})`
      }
    }

    // Canonicalization function
    const canonicalize = (rule, grammar, topGrammar) => {
      let unknownTransformer = () => {}

      if (grammar === undefined) {
        grammar = CSSGrammar
      }

      if (topGrammar === undefined) {
        topGrammar = grammar
      }

      if (!validateGrammar(grammar)) {
        return
      }

      if (grammar) {
        if (grammar.stylesheet) {
          grammar = topGrammar
        }

        if (grammar.unknown) {
          unknownTransformer = grammar.unknown
        }
      }

      const ret = {type: rule.type.toLowerCase()}
      let unparsedContents
      let contents
      let result

      if (rule.type === 'STYLESHEET') {
        contents = rule.value
      }

      else if (rule.type === 'BLOCK') {
        unparsedContents = rule.value
        ret.name = rule.name
      }

      else if (rule.type === 'QUALIFIED-RULE') {
        unparsedContents = rule.value.value
        ret.prelude = rule.prelude
      }

      else if (rule.type === 'AT-RULE') {
        unparsedContents = rule.value.value
        ret.name = rule.name
        ret.prelude = rule.prelude
      }

      else if (rule.type === 'DECLARATION') {
        // I don't do grammar-checking of declarations yet
        ret.name = rule.name
        ret.value = rule.value
        ret.important = rule.important

        return ret
      }

      if (unparsedContents) {
        if (grammar.declarations) {
          contents = parseAListOfDeclarations(unparsedContents)
        }

        else if (grammar.qualified) {
          contents = parseAListOfRules(unparsedContents)
        }
      }

      if (!grammar) {
        return ret
      } else if (grammar.declarations) {
        ret.declarations = {} // simple key/value map of declarations
        ret.rules = [] // in-order list of both decls and at-rules
        ret.errors = []

        for (let i = 0; i < contents.length; i++) {
          const rule = contents[i]

          if (rule instanceof Declaration) {
            const decl = canonicalize(rule, {}, topGrammar)

            ret.declarations[rule.name] = decl
            ret.rules.push(decl)
          }

          else { // rule is instanceof AtRule
            const subGrammar = grammar['@' + rule.name]

            if (subGrammar) { // Rule is valid in this context
              ret.rules.push(
                canonicalize(rule, subGrammar, topGrammar)
              )
            }

            else {
              result = unknownTransformer(rule)

              if (result) {
                ret.rules.push(result)
              }

              else {
                ret.errors.push(result)
              }
            }
          }
        }
      }

      else {
        ret.rules = []
        ret.errors = []

        for (let i = 0; i < contents.length; i++) {
          const rule = contents[i]

          if (rule instanceof QualifiedRule) {
            ret.rules.push(
              canonicalize(rule, grammar.qualified, topGrammar)
            )
          }

          else {
            const subGrammar = grammar['@' + rule.name]

            if (subGrammar) { // Rule is valid in this context
              ret.rules.push(
                canonicalize(rule, subGrammar, topGrammar)
              )
            }

            else {
              result = unknownTransformer(rule)

              if (result) {
                ret.rules.push(result)
              }

              else {
                ret.errors.push(result)
              }
            }
          }
        }
      }

      return ret
    }

    // Grammar validation
    const validateGrammar = grammar => true

    // CSS Grammar definition
    const CSSGrammar = {
      qualified: {declarations: true},
      '@media': {stylesheet: true},
      '@keyframes': {qualified: {declarations: true}},
      '@font-face': {declarations: true},
      '@supports': {stylesheet: true},
      '@scope': {stylesheet: true},
      '@counter-style': {declarations: true},
      '@import': null,
      '@font-feature-values': {
        // No qualified rules actually allowed,
        // but have to declare it one way or the other
        qualified: true,
        '@stylistic': {declarations: true},
        '@styleset': {declarations: true},
        '@character-variants': {declarations: true},
        '@swash': {declarations: true},
        '@ornaments': {declarations: true},
        '@annotation': {declarations: true},
      },
      '@viewport': {declarations: true},
      '@page': {
        declarations: true,
        '@top-left-corner': {declarations: true},
        '@top-left': {declarations: true},
        '@top-center': {declarations: true},
        '@top-right': {declarations: true},
        '@top-right-corner': {declarations: true},
        '@right-top': {declarations: true},
        '@right-middle': {declarations: true},
        '@right-bottom': {declarations: true},
        '@right-bottom-corner': {declarations: true},
        '@bottom-right': {declarations: true},
        '@bottom-center': {declarations: true},
        '@bottom-left': {declarations: true},
        '@bottom-left-corner': {declarations: true},
        '@left-bottom': {declarations: true},
        '@left-center': {declarations: true},
        '@left-top': {declarations: true},
      },
      '@custom-selector': null,
      '@custom-media': null
    }

    return {
      tokenize,
      parseAStylesheet,
      parseAListOfRules,
      parseARule,
      parseADeclaration,
      parseAListOfDeclarations,
      parseAComponentValue,
      parseAListOfComponentValues,
      parseACommaSeparatedListOfComponentValues,
      canonicalize,
      CSSGrammar
    }
  }
)