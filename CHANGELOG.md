# Change Log
All notable changes to the "vscode-textile-preview" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.3.12] - 20210921
### Changed
- [INTERNAL] Update build toolchain

### Added
- [TARGET] Build for web/servless extension host


## [1.3.11] - 20210912
### Changed
- [INTERNAL] Prepare update to vscode 1.56.2
- Update to vscode 1.56.2


## [1.3.10] - 20210514
### Changed
- [INTERNAL] Update dependencies

### Fixed
- [INTERNAL] npm audit fix
- [PREVIEW] remove embedding of code/inline into `<div>`. Closes #50


## [1.3.9] - 20210403
### Changed
- Update to vscode 1.55.0
- [DOC] Update Readme.md with current state
- [INTERNAL] Update dependencies, and VSCode minimal engine version
- [INTERNAL] Update textile-js to latest version 2.0.112

### Added
- [INTERNAL] Configure remote container, for manual testing purpose


## [1.3.8] - 20210131
### Changed
- [INTERNAL] prepare update to vscode-1.51.1
- Update to vscode 1.51.1
- [INTERNAL] Update textile-js to latest version 2.0.111

### Fixed
- [DEPENDENCIES] Update highlight.js for security fix
- [PREVIEW] Don't escape `<code>` and `<pre>` content


## [1.3.7] - 20201121
### Fixed
- [PREVIEW] Fix scrolling flickering when typing text in a Textile file containing images.
- [CSS] Use font-family from VSCode for `<code>`


## [1.3.6] - 20201110
### Changed
- Update to vscode 1.50.1
- [INTERNAL] add .vscodeignore to the tool to import sources from vscode
- [INTERNAL] Update dependencies
- [INTERNAL] Update textile-js to latest version 2.0.110
- [DOC] Update

### Fixed
- [INTERNAL] Fix build failure on CI


## [1.3.5] - 20201001
### Added
- [PREVIEW] Activate experimental custom editor

### Changed
- Update to vscode-1.47.3, without browser.webpack nor sourcemap removing
- Update to vscode 1.48.0
- Build on travis-ci.com

### Fixed
- [INTERNAL] fix npm security alerts


## [1.3.4] - 20200801
### Fixed
- [INTERNAL] Updated dependencies, and VSCode minimal engine version
- [INTERNAL] Import extra check to extension state, from Markdown extension
- [INTERNAL] Cleanup comments
- Update to vscode 1.46.0
- [I18N] Update translations to latest vscode-loc


## [1.3.3] - 20200508
### Changed
- [DOC] Change sponsoring links
- [DOC] Add installation instructions
- Update to vscode 1.45.0
- [I18N] Update translations to latest vscode-loc


## [1.3.2] - 20200409
### Fixed
- [INTERNAL] @types/vscode ^1.44.0 greater than engines.vscode ^1.38.0 => lower dependencies

### Changed
- 1.3.1 will not be released


## [1.3.1] - CANCELED
### Fixed
- [INTERNAL] npm audit fix
- update to vscode 1.44.0, wich includes some fixes

### Changed
- [DOC] Update README.md


## [1.3.0] - 20200330
### Added
- [DOC] include link to highlight.js supported language list.

### Changed
- [CSS] Clarify style for `<PRE>` and highlight.js
- [INTERNAL] Code cleanup
- Update textile-js to GehDoc/textile-js@e4c79e952a01104d9473022fae41ced7d093e2e3, to get refactored renderers code

### Fixed
- [INTERNAL] Make transpilation less permissive : enable `noUnusedLocals`. Progress on #8.
- [INTERNAL] Make transpilation less permissive : enable `noUnusedParameters`. Close #8.


## [1.3.0-beta.1] - 20200329
### Added
- [PREVIEW] blockquote syntax coloring

### Changed
- Update textile-js to GehDoc/textile-js@95e6732bedf55a104d27d9354a31e740bd4d9a71, to get render hook


## [1.2.1] - 20200329
### Added
- [DOC] Add SECURITY.md
- [PREVIEW] Add paragraph folding for multi-line `<LI>` and HTML code blocks (PRE, DIV, BLOCKQUOTE)

### Fixed
- [INTERNAL] npm audit fix
- [PREVIEW] correctly fold inlined tags

### Changed
- Update textile-js to GehDoc/textile-js@d9fd2e6517eb5b788afd34cb82c2c50d897cfc1e, to get new applyHooks function, and some fixes for `<LI>` and `<HR>` and other inlined tags


## [1.2.0] - 20200323
### Changed
- [DOC] Update
- Update to vscode 1.43.1
- [INTERNAL] update dependencies


## [1.1.1-dev] - 20200314

### Fixed
- [INTERNAL] fix npm security alerts
- Update textile-js to GehDoc/textile-js@72428b65a3e14fb2ebb370d845786790aeb3e7f8, to get HTML comments line-numbering, and a fix for `<LI>`

### Changed
- [INTERNAL] Include shared.webpack config to diffs.
- Update to vscode 1.43.0

### Added
- [SOURCE] Code folding. Progress on #4


## [1.1.0-dev] - 20200305
### Fixed
- [CSS] Fix highlight on hover for `<UL>`. Progress on #18.
- [INTERNAL] Reduces diffs with Markdown Language Features.

### Changed
- Update textile-js to GehDoc/textile-js@ae69c7a1d7b60aa417a0856801fe739a219d1fd7 , to benefit of pre-rendering hook and jsonml functions.
- [INTERNAL] : Improve and update .d.ts for textile-js library. Progress on #18.

### Added
- [PREVIEW] Add support for link ID generation trough slugify. Closes #20.
- [PREVIEW] Add support TOC generation trough slugify. Progress on #4.
- [SOURCE] Add support for document and workspace symbol. Progress on #4.


## [1.0.0] - 20200301
### Added
- [DOC] clarify "textile" guards in the code source, and explain how-to use them in CONTRIBUTING.md
- [DOC] Tests are required.
- [DOC] CONTRIBUTING : announce our modified Textile.js web live editor
- [PREVIEW] Activate tokens caching
- [INTERNAL] Add script to convert screencast formats (WEBM to GIF)

### Changed
- [INTERNAL] Clarify prepare_vscode_tree.sh feedbacks
- Update to vscode 1.42.1
- [PREVIEW] Init Textile-js options at the right place, and remove unused variable and comment.
- Update textile-js to GehDoc/textile-js@34e3fdff0de965d858b161bce5bc5f30ba4067ec , to allow implementation of tokens caching.
- Update textile-js to GehDoc/textile-js@242ba1197c469fb99f3ab276004b82b7aca83a0d , to get library versioning and fresh sources (updated webpack).
- [OPTIONS] Disable 'linkify' option (wasn't working). Progress on #3

### Fixed
- [PREVIEW] Use font-size and line-height from VSCode's parameters. Progess on #3


## [0.3.8] - 20200210
### Fixed
- [PREVIEW] Allow accurate hover on multi-levels LI. Closes #5.
- [CSS] small fix of high contrast theme.

### Changed
- Update to vscode 1.42.0

### Added
- Contributing guide. Closes #15.


## [0.3.7] - 20200204
### Fixed
- [DEPENDENCIES] Update textile-js to GehDoc/textile-js@37dd69bab97778579cf60e27b5c3036682597730. Fixes #30, #31, and a problem of wrongly parsed block after some blank lines.
- [DOC] Clarified feature list.
- [SOURCE] Some tooltips where doubled, because the list of extracted links wasn't sorted.

### Changed
- [INTERNAL] Share languages lists between tools. Closes #16.


## [0.3.6] - 20200201
### Added
- [SOURCE] Implement links and image extraction and activation. Closes #21.

### Changed
- Update to vscode 1.41.1
- [DOC] Clarify features


## [0.3.5] - 20191218
### Changed
- Update to vscode 1.41.0

### Fixed
- vscode 1.41.0 fixes : #24, #32.
- [CSS] "bc." highlighting on select/hover was broken


## [0.3.4] - 2019-12-12
### Fixed
- [DEPENDENCIES] Update webpack
- [DOC] Fix garbage at the end of README.md on Visual Studio Code Marketplace

### Changed
- [INTERNAL] Prepare update to vscode 1.41.0
- [I18N] Update to latest vscode-loc


## [0.3.3] - 2019-12-09
### Added
- [INTERNAL] split markdown.css in the tool to import sources from vscode

### Changed
- [CSS] harmonize ```<pre>``` style with markdown preview

### Fixed
- [DEPENDENCIES] Update webpack-copy


## [0.3.2] - 2019-11-11
### Added
- [DOC] Add sponsorship link on GitHub and on README.md

### Fixed
- [INTERNAL] git update process was broken

### Changed
- Update to vscode-1.40.0


## [0.3.1] - 2019-10-20
### Fixed
- [INTERNAL] Build process was broken (I was using a patched version of vscode-nls-dev)
- [CSS] Fix : #23, #27

### Added
- [INTERNAL] Add Travis CI, to launch test suite after each push to the repository : Linux & OS X

### Changed
- [CSS] Splitted to ease future updates


## [0.3.0] - 2019-10-17
### Added
- [DOC] Adhere to CII best practices
- [DOC] Create code of conduct
- [DOC] Add features summary

### Fixed
- [DOC] Bigger icon

### Changed
- [DOC] Roadmap updated


## [0.2.8] - 2019-10-13
### Changed
- Update to vscode-1.39.1


## [0.2.7] - 2019-10-11
### Changed
- [INTERNAL] pack the extension with webpack

### Added
- [DOC] Add more stats

### Fixed
- [INTERNAL] Reactivate src processing, in the tool to import sources from vscode
- [INTERNAL] Improve src processing, in the tool to import sources from vscode
- [CSS] corrections // vscode


## [0.2.6] - 2019-10-09
### Changed
- Udate translations from vscode-loc repo

### Fixed
- [INTERNAL] vscode-nls : use 1 file bundle


## [0.2.5] - 2019-10-08
### Added
- [INTERNAL] : Add .d.ts for textile-js library
- [INTERNAL] : Imports the tests from mardown preview, when they are coherent for Textile.
- [DOC] : Add screencast to show some features

### Fixed
- [INTERNAL] : in root tsconfig.json file, reactivate : noImplicitAny

### Changed
- bugs/enhancements are now reported on GitHub issues
- roadmap is now in GitHub project


## [0.2.4] - 2019-10-06
### Added
- translations : DE, ES, IT, KO, RU, ZH-TW, ZH-CN. Now, all the 9 core languages are imported : https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs


## [0.2.3] - 2019-10-06
### Changed
- [INTERNAL] : prepare the import tool for batch processing of translations.
- Update FR and EN translations

### Added
- JA translation


## [0.2.2] - 2019-09-27
### Fixed
- Initialize correctly vscode-nls
- Checked : dependencies are now recent enough depencies (gulp, ... ?)

### Changed
- Remove Telemetry Reporter, as it requires a non free Azure account
- update to vscode-nls-dev > 2.0.1


## [0.2.1] - 2019-09-26
### Fixed
- webpack generated files were missing from the VSIX package
- correctly depends on vscode
- correct VSIX file was broken due to dependencies not installed by vscode


## [0.2.0] - 2019-09-26
### Fixed
- vscode-nls : integrate French entirely
- add LICENSES directory, and change links from ./README.md
- check all links in ./README.md
- fix github security alerts

### Changed
- change logo, remove old png/svg
- choose publisher
- update version to 0.2.0, compile, publish to marketplace, publish to github


## [0.1.2] - 2019-09-25
- Initial release