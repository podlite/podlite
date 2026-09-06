<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core-dark.svg">
    <img src="https://raw.githubusercontent.com/podlite/podlite/main/assets/podlite-mark-core.svg" width="350" alt="@podlite/editor-react">
  </picture>
</p>
<p align="center"><em>rich text editor React component for Podlite — syntax highlighting, live preview, CodeMirror 6</em></p>

```sh
npm install @podlite/editor-react
```

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

## Code highlighting

Code blocks are rendered through `@podlite/highlight`, which loads `shiki` on
demand. `shiki` ships as a dependency of this package, so there is nothing for
you to install and nothing to configure. It is split into its own chunk: a
reader who never meets a code block downloads none of it.

## Author

Copyright (c) 2021–2026 Aliaksandr Zahatski

## License

Released under a MIT License.
