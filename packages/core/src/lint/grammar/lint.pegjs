{
  options.diagnostics = options.diagnostics || [];
  options._blockStack = options._blockStack || [];
}

start
  = (rule_match / .)*

rule_match
  = attr_nested_angle
  / delim_begin
  / delim_end

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
      return null;
    }

// === Shared tokens ===
identifier "identifier"
  = $([a-zA-Z][a-zA-Z0-9_-]*)

sol "start-of-line"
  = &{ return location().start.column === 1 }

__ "whitespace"
  = [ \t]+
