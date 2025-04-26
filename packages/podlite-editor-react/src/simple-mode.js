// added support for blankline by Aliaksandr Zahatski
// Source:it's not possible to detect empty lines :https://discuss.codemirror.net/t/detect-blank-lines-with-simple-mode/2167/3

export const simpleMode = function (states) {
  ensureState(states, 'start')
  var states_ = {},
    meta = states.languageData || {},
    hasIndentation = false
  for (var state in states)
    if (state != meta && states.hasOwnProperty(state)) {
      var list = (states_[state] = []),
        orig = states[state]
      for (var i = 0; i < orig.length; i++) {
        var data = orig[i]
        list.push(new Rule(data, states))
        if (data.indent || data.dedent) hasIndentation = true
      }
    }
  return {
    name: meta.name,
    startState: function () {
      return { state: 'start', pending: null, indent: hasIndentation ? [] : null }
    },
    copyState: function (state) {
      var s = {
        state: state.state,
        pending: state.pending,
        indent: state.indent && state.indent.slice(0),
        blankLine: state.blankLine && state.blankLine,
      }
      if (state.stack) s.stack = state.stack.slice(0)
      return s
    },
    token: tokenFunction(states_),
    indent: indentFunction(states_, meta),
    blankLine: function (state) {
      // console.log("BKANK LINE!")
      state.blankLine = 1
    },
    languageData: meta,
    tokenTable: states.tokenTable,
  }
}

function ensureState(states, name) {
  if (!states.hasOwnProperty(name)) throw new Error('Undefined state ' + name + ' in simple mode')
}

function toRegex(val, caret) {
  if (!val) return /(?:)/
  var flags = ''
  if (val instanceof RegExp) {
    if (val.ignoreCase) flags = 'i'
    val = val.source
  } else {
    val = String(val)
  }
  return new RegExp((caret === false ? '' : '^') + '(?:' + val + ')', flags)
}

function asToken(val) {
  if (!val) return null
  if (val.apply) return val
  if (typeof val == 'string') return val.replace(/\./g, ' ')
  var result = []
  for (var i = 0; i < val.length; i++) result.push(val[i] && val[i].replace(/\./g, ' '))
  return result
}

function Rule(data, states) {
  // if (data.next || data.push) ensureState(states, data.next || data.push);
  if (data.push) ensureState(states, data.push)
  this.regex = toRegex(data.regex)
  this.token = asToken(data.token)
  this.data = data
}

function tokenFunction(states) {
  return function (stream, state) {
    if (state.pending && state.pending.length) {
      var pend = state.pending.shift()
      if (state.pending.length == 0) state.pending = null
      if (!pend?.text?.length) {
        // console.log({pend})
      }
      stream.pos += pend.text.length
      return pend.token
    }
    // if we detect previusly blankline -> try to
    // modify state only

    const ruleBlankLine = states[state.state].find(i => i.data.blankline)
    // console.log("start analize blank line" + JSON.stringify(ruleBlankLine))
    if (state.blankLine && ruleBlankLine) {
      if (ruleBlankLine.data.next) {
        state.state = ruleBlankLine.data.next
      } else if (ruleBlankLine.data.push) {
        ;(state.stack || (state.stack = [])).push(state.state)
        state.state = ruleBlankLine.data.push
      } else if (ruleBlankLine.data.pop && state.stack && state.stack.length) {
        state.state = state.stack.pop()
      }
    }
    // console.log("end analize blank line" + state.state)
    state.blankLine = undefined
    var curState = states[state.state]
    for (var i = 0; i < curState.length; i++) {
      var rule = curState[i]
      var matches = (!rule.data.sol || stream.sol()) && stream.match(rule.regex)
      // console.log({stream, matches, rule, post:stream.pos, sol:stream.sol(), eol:stream.eol(), blankLine:state.blankLine},stream.string.slice(stream.pos), state.state)
      if (matches) {
        if (rule.data.next) {
          var next = rule.data.next
          if (next.apply) next = next(matches)
          state.state = next
        } else if (rule.data.push) {
          ;(state.stack || (state.stack = [])).push(state.state)
          state.state = rule.data.push
        } else if (rule.data.pop && state.stack && state.stack.length) {
          state.state = state.stack.pop()
        }

        if (rule.data.indent) state.indent.push(stream.indentation() + stream.indentUnit)
        if (rule.data.dedent) state.indent.pop()
        var token = rule.token
        if (token && token.apply) token = token(matches, state)
        if (matches.length > 2 && rule.token && typeof rule.token != 'string') {
          state.pending = []
          for (var j = 2; j < matches.length; j++)
            if (matches[j]) {
              state.pending.push({ text: matches[j], token: token[j - 1] })
              //   console.log(JSON.stringify(state.pending))
            }
          //   (state.pending || (state.pending = [])).push({ text: matches[j], token: token[j - 1] })
          stream.backUp(matches[0].length - (matches[1] ? matches[1].length : 0))
          return token[0]
        } else if (token && token.join) {
          return token[0]
        } else {
          return token
        }
      }
    }
    stream.next()
    return null
  }
}

function indentFunction(states, meta) {
  return function (state, textAfter) {
    if (state.indent == null || (meta.dontIndentStates && meta.dontIndentStates.indexOf(state.state) > -1)) return null

    var pos = state.indent.length - 1,
      rules = states[state.state]
    scan: for (;;) {
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i]
        if (rule.data.dedent && rule.data.dedentIfLineStart !== false) {
          var m = rule.regex.exec(textAfter)
          if (m && m[0]) {
            pos--
            if (rule.next || rule.push) rules = states[rule.next || rule.push]
            textAfter = textAfter.slice(m[0].length)
            continue scan
          }
        }
      }
      break
    }
    return pos < 0 ? 0 : state.indent[pos]
  }
}
