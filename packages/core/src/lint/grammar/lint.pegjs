{
  options.diagnostics = options.diagnostics || [];
  options._blockStack = options._blockStack || [];
  options.verbatimBlocks = options.verbatimBlocks || [];
  if (typeof options._inDirective !== 'boolean') options._inDirective = false;
}

start
  = (rule_match / .)*

rule_match
  = attr_nested_angle
  / delim_begin
  / delim_end
  / paragraph_directive
  / continuation_attr
  / continuation_marker
  / blank_line_marker
  / line_marker

// === attr-nested-angle ===
attr_nested_angle
  = ":" name:identifier "<" !"<" value:$([^>]*) ">"
    {
      // only a real attribute list is checked: `<` and `>` in running text or in
      // a verbatim block are not markup
      const verbatim = options._blockStack.some(b => options.verbatimBlocks.indexOf(b.name) !== -1);
      if (!options._inDirective || verbatim) return null;
      const advice = "use a non-conflicting delimiter (\"...\", (...), <<...>>) or plain text";
      // the mirror case: the value ended at a `>` written inside it, and the one
      // the author meant as the closing bracket is still ahead on the line
      const rest = input.slice(peg$savedPos + text().length).split(/\r?\n/)[0];
      const closedEarly = rest.indexOf('>') !== -1 && !/^[ \t]*:/.test(rest);
      if (value.indexOf('<') !== -1) {
        options.diagnostics.push({
          rule: 'attr-nested-angle',
          severity: 'error',
          message: "attribute value contains a nested <…> that closes the attribute early; " + advice,
          location: location()
        });
      } else if (closedEarly) {
        options.diagnostics.push({
          rule: 'attr-nested-angle',
          severity: 'error',
          message: "attribute value contains a > that closes the attribute early; " + advice,
          location: location()
        });
      }
      return null;
    }

// === delimited-block-balance ===
delim_begin
  = sol "=begin" __ name:identifier
    {
      const top = options._blockStack[options._blockStack.length - 1];
      const verbatim = top && options.verbatimBlocks.indexOf(top.name) !== -1;
      if (verbatim) {
        // the same name closes the enclosing block early and orphans the marker after it
        if (top.name === name) {
          options.diagnostics.push({
            rule: 'delimited-block-balance',
            severity: 'error',
            message: "=begin " + name + " nested inside =begin " + name + " (opened at line " + top.location.start.line + "); indent inner =begin/=end markers by one space to make them verbatim content",
            location: location()
          });
        }
        options._inDirective = false;
        return null;
      }
      options._blockStack.push({ name: name, location: location() });
      options._inDirective = true;
      return null;
    }

delim_end
  = sol "=end" __ name:identifier
    {
      const top = options._blockStack[options._blockStack.length - 1];
      // a verbatim block runs to its own =end, so any other marker inside it is content
      if (top && top.name !== name && options.verbatimBlocks.indexOf(top.name) !== -1) {
        options._inDirective = false;
        return null;
      }
      if (!top) {
        options.diagnostics.push({
          rule: 'delimited-block-balance',
          severity: 'error',
          message: "=end " + name + " without matching =begin",
          location: location()
        });
      } else if (top.name !== name) {
        options.diagnostics.push({
          rule: 'delimited-block-balance',
          severity: 'error',
          message: "=end " + name + " does not match =begin " + top.name + " (opened at line " + top.location.start.line + ")",
          location: location()
        });
        options._blockStack.pop();
      } else {
        options._blockStack.pop();
      }
      options._inDirective = false;
      return null;
    }

// === attr-continuation-dropped ===
paragraph_directive
  = sol "=for" __ identifier
    {
      options._inDirective = true;
      return null;
    }

continuation_attr
  = sol __ ":" "!"? name:identifier value_delim
    {
      // any verbatim block on the stack makes this line content: markers written
      // inside such a block are an example, not structure
      const verbatim = options._blockStack.some(b => options.verbatimBlocks.indexOf(b.name) !== -1);
      if (options._inDirective && !verbatim) {
        options.diagnostics.push({
          rule: 'attr-continuation-dropped',
          severity: 'warning',
          message: "attribute :" + name + " on continuation line is silently dropped; flatten onto the directive line",
          location: location()
        });
      }
      return null;
    }

value_delim
  = "<" / "(" / "{" / "[" / "'" / "\"" / "｢"

// a continuation line keeps the configuration context open
continuation_marker
  = sol "=" [ \t]+
    {
      options._inDirective = true;
      return null;
    }

blank_line_marker
  = sol [ \t]* "\n"
    {
      options._inDirective = false;
      return null;
    }

line_marker
  = sol .
    {
      options._inDirective = false;
      return null;
    }

// === Shared tokens ===
identifier "identifier"
  = $([a-zA-Z][a-zA-Z0-9_-]*)

sol "start-of-line"
  = &{ return location().start.column === 1 }

__ "whitespace"
  = [ \t]+
