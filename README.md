# Textile Language Features

[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version-short/GehDoc.vscode-textile-preview.svg)](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/GehDoc.vscode-textile-preview.svg)](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview)

Full featured document live preview for the [Textile](https://en.wikipedia.org/wiki/Textile_(markup_language)) markup language.

*Still Alpha version !! See the [Roadmap](#roadmap).*

Based on the source code of [Visual Studio Code's Markdown preview](https://github.com/microsoft/vscode/tree/master/extensions/markdown-language-features), it uses a modified version of [textile.js](https://github.com/GehDoc/textile-js) Textile to HTML parser in order to display live preview.

## Working with Textile

Create or open any file with a .textile extension, and then you can toggle the visualization of the editor between the code and the preview of the [Textile](https://en.wikipedia.org/wiki/Textile_(markup_language)) file.
To switch between views, press (<kbd>Ctrl+Shift+V</kbd>) in the editor. You can view the preview side-by-side (<kbd>Ctrl+K</kbd> <kbd>V</kbd>) with the file you are editing and see changes reflected in real-time as you edit.

![Demo](https://raw.githubusercontent.com/GehDoc/vscode-textile-preview/master/media/readme/video_scroll-sync.resized.gif)

## Features

To see the full list of features and interactions, you can read the documentation of the [Visual Studio Code's Markdown preview](https://code.visualstudio.com/docs/languages/markdown#_markdown-preview).

This extension is entirely based on the Markdown preview provided by Visual Studio Code, and tries to offer the same functionalities.

### Missing features

For now, some features of the original Markdown preview have been disabled.

Features considered out of scope of this extension :
* Snippets / Source syntax coloring : You have to use another extensions for these purpose.
* Bloc-quote syntax coloring : Need another textile to HTML engine
* Support plugins, like mardown-it : Need antother textile to HTML engine
* Telemetry Reporter : Need a non free Azure account : https://www.npmjs.com/package/vscode-extension-telemetry
* Add other translations than the 9 core languages listed there (unless requested) : https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs

Features to be implemented / triaged :
* Make all links clickable in the source document (linkProvider)
* Paragraph folding
* Generation of table of content, and table of symbols
* Support 'linkify' option

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Roadmap

The todo-list for the first beta is on GitHub, in the project [VSCode Textile Preview Extension](https://github.com/GehDoc/vscode-textile-preview/projects/1).

All existing bugs/enhancements are already tagged to create the following roadmap : BETA, RELEASE 1.0.0, then FUTURE.

## Support this project

You can support this project by :
* reporting any bug / suggestion to [GitHub repository](https://github.com/GehDoc/vscode-textile-preview).
* giving feedback and rating through [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview).

## License

This project is licensed under the terms of the [MIT license](./LICENSE.txt).

It is entirely based on :
* [Visual Studio Code's Markdown preview](https://github.com/Microsoft/vscode/tree/master/extensions/markdown-language-features) under the terms of the [MIT license](LICENSES/vscode-LICENSE.txt).  
* and, the [Visual Studio Code Language Packs](https://github.com/microsoft/vscode-loc) under the terms of the [MIT license](LICENSES/vscode-loc-LICENSE.md).

It includes a modified version of [textile-js](https://github.com/GehDoc/textile-js) under the terms of the [MIT license](LICENSES/textile-js-LICENSE.txt).

The Textile logo mark is from [Textile logo marks](https://github.com/textile/textile-mark) under [Creative Commons CC0 1.0 Universal (CC0 1.0) License](https://creativecommons.org/publicdomain/zero/1.0/legalcode).
