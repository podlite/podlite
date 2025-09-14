# @podlite/publisher

## Upcoming

## 0.0.11

- implement Selector for `doc:<NAME|ID>`

## 0.0.6

- implement resolvers for `=include` block

## 0.0.5

- initial support for `=Include` blocks and Selectors (https://podlite.org/specification#Selectors)
- add support for embeded data using `=data` block
- refactor existed and added new plugins:
  - docs-injector-plugin
  - dump-pages-plugin
  - include-resolve-plugin.spec
  - prev-next-plugin

## 0.0.4

- add template configuration attribute for site: `:templateFile<file path>`
- fix publishRecord

## 0.0.3

- fix deps

## 0.0.1

- plugins :breadcrumb-plugin, links-plugin, terms-index-plugin
- support tempating for docs
- fix processing templates
- add helper `isExistsDocBlocks`
