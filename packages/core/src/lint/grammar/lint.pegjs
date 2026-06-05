{
  options.diagnostics = options.diagnostics || [];
  options._blockStack = options._blockStack || [];
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
  / blank_line_marker
  / line_marker

// === attr-nested-angle ===
attr_nested_angle
  = ":" name:identifier "<" !"<" value:$([^>]*) ">"
    {
      if (value.indexOf('<') !== -1) {
        options.diagnostics.push({
          rule: 'attr-nested-angle',
          severity: 'error',
          message: "attribute value contains a nested <…> that closes the attribute early; use a non-conflicting delimiter (\"...\", [...], (...), <<...>>) or plain text",
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
      if (top && top.name === name) {
        options.diagnostics.push({
          rule: 'delimited-block-balance',
          severity: 'error',
          message: "=begin " + name + " nested inside =begin " + name + " (opened at line " + top.location.start.line + "); indent inner =begin/=end markers by one space to make them verbatim content",
          location: location()
        });
      }
      options._blockStack.push({ name: name, location: location() });
      options._inDirective = true;
      return null;
    }

delim_end
  = sol "=end" __ name:identifier
    {
      const top = options._blockStack[options._blockStack.length - 1];
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
  = sol __ ":" name:identifier "<"
    {
      if (options._inDirective) {
        options.diagnostics.push({
          rule: 'attr-continuation-dropped',
          severity: 'warning',
          message: "attribute :" + name + "<…> on continuation line is silently dropped; flatten onto the directive line",
          location: location()
        });
      }
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
