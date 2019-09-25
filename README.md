# Textile Live Preview

Full featured document preview for the [Textile](https://en.wikipedia.org/wiki/Textile_(markup_language)) markup language.

*Still Alpha version !! See the [Roadmap](#known-issues--todo--roadmap).*

Based on the source code of [Visual Studio Code's Markdown preview](https://github.com/microsoft/vscode/tree/master/extensions/markdown-language-features), it uses a modified version of [textile.js](https://github.com/GehDoc/textile-js) Textile to HTML parser in order to display live preview.

## Working with Textile

Create or open any file with a .textile extension, and then you can toggle the visualization of the editor between the code and the preview of the [Textile](https://en.wikipedia.org/wiki/Textile_(markup_language)) file.
To switch between views, press (<kbd>Ctrl+Shift+V</kbd>) in the editor. You can view the preview side-by-side (<kbd>Ctrl+K</kbd> <kbd>V</kbd>) with the file you are editing and see changes reflected in real-time as you edit.

To see the full list of features and interactions, you can read the documentation of the [Visual Studio Code's Markdown preview](https://code.visualstudio.com/docs/languages/markdown#_markdown-preview).

This extension is entirely based on the Markdown preview provided by Visual Studio Code, and tries to offer the same functionalities.

### Missing features

Out of scope :
* Snippets / Source syntax coloring : You have to use another extensions for these purpose.
* Bloc-quote syntax coloring : Need another textile to HTML engine
* Support plugins like mardown-it : Need antother textile to HTML engine

To be done / triaged :
* *internal :* Import tests.
* Make all links clickable in the source document (linkProvider)
* Paragraph folding
* Generation of table of content, and table of symbols
* Support 'linkify' option
* Translations (now only English and French)


## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Known issues / TODO / Roadmap

* (BETA) - Fill bug reports on github, for all of the following
* (BETA) - finalize the tool to [ease update from VSCode tree](tools/prepare_vscode_tree.sh).
* implement the "Missing features" (see above) :
	* (BETA) - *internal :* import tests
	* (BETA) - reintegrate all translations from "Visual Studio Code's Markdown preview" (now, only French), from here : vscode/i18n/[LANG]/extensions/markdown/package.i18n.json
	* (RELEASE) - support / deprecate all options
	* (FUTURE) - implement other features
* (ALPHA) - Improvements / bugs :
	* **OK** vscode-nls : integrate French entirely
	* **OK** change logo, remove old png/svg
	* **OK** publisher : choose !
	* **OK** add LICENSES directory, and change links from README.md
	* **OK** Before last : check all links in README.md
	* fix github security alerts
	* Last : update version to 0.2.0, compile, publish to marketplace, publish to github
* (BETA) - Improvements / bugs :
	* vscode-nls : use 1 file bundle => update to vscode-nls-dev > 2.0.1 ?
	* update all depencies (gulp, ... ?)
	* check webpack use in build process : missing from 'package' command
	* add patreon/github sponsor link
	* Last : remove "alpha notice" from README.md
* (RELEASE) - Fix bugs for release :
	* (VERIFY) click on LI preview, highlights the UL : it should highlight the LI
* (RELEASE) - Improvements for release :
	* improve documentation
	* update to the last version of vscode
	* Last : remove "beta notice" from README.md
* (BETA) - Verify / Report these bugs to vscode mardown preview :
	* double-click inside preview should not open a new source view, if the source is already opened and not focused : in this case, it should focus the vscode tab containing this source.
	* conflict with Visual Studio Code's Markdown preview for all keybindings. *Ex :* <kbd>Ctrl+Shift+V</kbd>.
* (FUTURE) - Improvements :
	* more tests
	* generate/find Typescript declaration file for textile-js
	* line-number support for at least :
		* block HTML (inside "pre"),
		* parseTable (WIP : need CSS for different vscode theme, and selection-marker's height is not dynamic),
		* parseDefList
		* lists (WIP : selection-marker still too far at left + ordered/unordered doesn't have the same left padding)
	* (FUTURE) - cleanup CSS (remove entierely textile-js.css ?)
	* (FUTURE) - rebase textile-js on [it's original repo](https://github.com/borgar/textile-js) :
		* I'm using my fork https://github.com/GehDoc/textile-js for now. I'm waiting an approval for this PR : https://github.com/borgar/textile-js/pull/51.
		* If this PR is not accepted, I'll slowly maitain my fork.
	* use another textile engine, with [Redmine](https://www.redmine.org/) support.


## License

This project is licensed under the terms of the [MIT license](./LICENSE.txt).

It is entirely based on :
* [Visual Studio Code's Markdown preview](https://github.com/Microsoft/vscode/tree/master/extensions/markdown-language-features) under the terms of the [MIT license](LICENSES/vscode-LICENSE.txt).  
* and, the [Visual Studio Code Language Packs](https://github.com/microsoft/vscode-loc) under the terms of the [MIT license](LICENSES/vscode-loc-LICENSE.md).

It includes a modified version of [textile-js](https://github.com/GehDoc/textile-js) under the terms of the [MIT license](LICENSES/textile-js-LICENSE.txt).

The Textile logo mark is from [Textile logo marks](https://github.com/textile/textile-mark) under [Creative Commons CC0 1.0 Universal (CC0 1.0) License](https://creativecommons.org/publicdomain/zero/1.0/legalcode).
