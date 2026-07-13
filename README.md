<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core-dark.svg">
    <img src="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core.svg" width="350" alt="Podlite">
  </picture>
</p>
<p align="center"><em>one markup, many possibilities</em></p>
<p align="center">lightweight block-based markup language with parser, AST and renderers</p>

<p align="center">
  <a href="https://www.npmjs.com/package/podlite"><img src="https://img.shields.io/npm/v/podlite" alt="npm"></a>
  <a href="https://www.npmjs.com/package/podlite"><img src="https://img.shields.io/npm/dm/podlite" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

Podlite is a universal markup language unbound by any specific domain, programming language, or concept. It supports Markdown as a standard block, allowing familiar syntax alongside structured Podlite blocks.

Extensibility is a core feature — define domain-specific blocks and expand the language to fit your project. Podlite works for documentation, blogs, educational materials, knowledge bases and more.

**What it is:** one spec-defined grammar and one canonical AST — block boundaries and typed attributes that survive regeneration by AI agents and round-trips between tools.

**What it is NOT:** a Markdown replacement for every case. Markdown wins on ubiquity, and your Markdown parses in unchanged. Podlite wins when structure has to be machine-checkable.

### Try it

```bash
npm i @podlite/schema
node -e "const {parse}=require('@podlite/schema'); console.dir(parse('=head1 Hello World'), {depth:5})"
```

Every node comes back typed, with a `location: { line, column }` — a structural break points at a line instead of vanishing into a re-render.

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
