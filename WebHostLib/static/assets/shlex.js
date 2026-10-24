'use strict'

/*
  Modified from node-shlex (https://github.com/rgov/node-shlex) with some
  unused functionality removed and a change to output removed string parts when
  parsing. Original licensing info:

  MIT License

  Copyright (c) 2018 Ryan Govostes

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.


  Port of a subset of the features of CPython's shlex module, which provides a
  shell-like lexer. Original code by Eric S. Raymond and other contributors.
*/

class Shlexer {
  constructor (string) {
    this.i = 0
    this.string = string

    /**
     * Characters that will be considered whitespace and skipped. Whitespace
     * bounds tokens. By default, includes space, tab, linefeed and carriage
     * return.
     */
    this.whitespace = ' \t\r\n'

    /**
     * Characters that will be considered string quotes. The token accumulates
     * until the same quote is encountered again (thus, different quote types
     * protect each other as in the shell.) By default, includes ASCII single
     * and double quotes.
     */
    this.quotes = `'"`

    /**
     * Characters that will be considered as escape. Just `\` by default.
     */
    this.escapes = '\\'

    /**
     * The subset of quote types that allow escaped characters. Just `"` by default.
     */
    this.escapedQuotes = '"'

    this.debug = false
  }

  readChar () {
    return this.string.charAt(this.i++)
  }

  processEscapes (string, quote) {
    if (!this.escapedQuotes.includes(quote)) {
      // This quote type doesn't support escape sequences
      return string
    }

    // We need to form a regex that matches any of the escape characters,
    // without interpreting any of the characters as a regex special character.
    const anyEscape = '[' + this.escapes.replace(/(.)/g, '\\$1') + ']'

    // In regular quoted strings, we can only escape an escape character, and
    // the quote character itself.
    const re = new RegExp(
      anyEscape + '(' + anyEscape + '|\\' + quote + ')', 'g')
    return string.replace(re, '$1')

    // Should not get here
    return undefined
  }

  * [Symbol.iterator] () {
    let inQuote = false
    let escaped = false
    let token

    if (this.debug) {
      console.log('full input:', '>' + this.string + '<')
    }

    while (true) {
      const pos = this.i
      const char = this.readChar()

      if (this.debug) {
        console.log(
          'position:', pos,
          'input:', '>' + char + '<',
          'accumulated:', token,
          'inQuote:', inQuote,
          'escaped:', escaped
        )
      }

      // Ran out of characters, we're done
      if (char === '') {
        if (inQuote) { throw new Error('Got EOF while in a quoted string') }
        if (escaped) { throw new Error('Got EOF while in an escape sequence') }
        if (token !== undefined) { yield token }
        return
      }

      // We were in an escape sequence, complete it
      if (escaped) {
        if (char === '\n') {
          // An escaped newline just means to continue the command on the next
          // line. We just need to ignore it.
        } else if (inQuote) {
          // If we are in a quote, just accumulate the whole escape sequence,
          // as we will interpret escape sequences later.
          token = (token || '') + escaped + char
        } else {
          // Just use the literal character
          token = (token || '') + char
        }

        escaped = false
        continue
      }

      if (this.escapes.includes(char)) {
        if (!inQuote || this.escapedQuotes.includes(inQuote)) {
          // We encountered an escape character, which is going to affect how
          // we treat the next character.
          escaped = char
          continue
        } else {
          // This string type doesn't use escape characters. Ignore for now.
        }
      }

      // We were in a string
      if (inQuote !== false) {
        // String is finished. Don't grab the quote character.
        if (char === inQuote) {
          token = this.processEscapes(token, inQuote)
          inQuote = false
          continue
        }

        // String isn't finished yet, accumulate the character
        token = (token || '') + char
        continue
      }

      // This is the start of a new string, don't accumulate the quotation mark
      if (this.quotes.includes(char)) {
        inQuote = char
        token = (token || '') // fixes blank string

        continue
      }

      // This is whitespace, so yield the token if we have one
      if (this.whitespace.includes(char)) {
        if (token !== undefined) { yield token }
        token = undefined
        continue
      }

      // Otherwise, accumulate the character
      token = (token || '') + char
    }
  }
}


/**
 * Splits a given string using shell-like syntax.
 *
 * @param {String} s String to split.
 * @returns {String[]}
 */
function shlex_split (s) {
  return Array.from(new Shlexer(s))
}
