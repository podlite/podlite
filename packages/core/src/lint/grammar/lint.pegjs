{
  options.diagnostics = options.diagnostics || [];
}

start
  = (attr_nested_angle / .)*

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

identifier "identifier"
  = $([a-zA-Z][a-zA-Z0-9_-]*)
