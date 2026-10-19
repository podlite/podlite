<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core-dark.svg">
    <img src="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core.svg" width="350" alt="Podlite">
  </picture>
</p>
<p align="center"><strong>Markup for AI agents. Structure you can check.</strong></p>
<p align="center">Parser, CLI, and MCP server for the Podlite markup language.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/podlite"><img src="https://img.shields.io/npm/v/podlite" alt="npm"></a>
  <a href="https://www.npmjs.com/package/podlite"><img src="https://img.shields.io/npm/dm/podlite" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

Extensibility is a core feature — define domain-specific blocks and expand the language to fit your project. Podlite works for documentation, blogs, educational materials, knowledge bases and more.

Blocks keep their start, end, and typed attributes. `podlite lint` reports a block left open, with its line.

Markdown files are read as Markdown.

### Try it

```bash
npm i @podlite/schema
node -e "const {parse}=require('@podlite/schema'); console.dir(parse('=head1 Hello World'), {depth:5})"
```

Blocks come back typed, with `location.start` and `location.end`.

## Ecosystem

<div align="center">
<table border=0><tr><td valign=top><div align="center">

##### specification

</div>

- [Source](https://github.com/podlite/podlite-specs)
- [HTML](https://podlite.org/specification)
- [Discussions](https://github.com/podlite/podlite-specs/discussions)

<div align="center">

##### implementation

</div>

- [Source](https://github.com/podlite/podlite)
- [Changelog](https://github.com/podlite/podlite/releases)
- [Issues](https://github.com/podlite/podlite/issues)

</td><td valign=top><div align="center">

##### publishing

</div>

- [Podlite-web](https://github.com/podlite/podlite-web)
- [How-to article](https://zahatski.com/2022/8/23/1/start-you-own-blog-site-with-podlite-for-web)
- [Changelog](https://github.com/podlite/podlite-web/releases)

</td><td valign=top><div align="center">

##### desktop editor

</div>

- [Releases](https://github.com/podlite/podlite-desktop/releases)
- [Issues](https://github.com/podlite/podlite-desktop/issues)
- Stores: [Mac](https://apps.apple.com/us/app/podlite/id1526511053) · [Windows](https://www.microsoft.com/store/apps/9NVNT9SNQJM8) · [Linux](https://snapcraft.io/podlite)

</td><td valign=top><div align="center">

##### resources

</div>

- [podlite.org](https://podlite.org)
- [pod6.in](https://pod6.in/)
- [github.com/podlite](https://github.com/podlite/)
- [Funding](https://opencollective.com/podlite)

</td></tr></table>
</div>

## Author

Copyright (c) 2021–2026 Aliaksandr Zahatski

## License

Released under a MIT License.
