# Textile Language Features

[![Marketplace Version](https://badgen.net/vs-marketplace/v/GehDoc.vscode-textile-preview?label=VS%20marketplace)](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview "View this project on Visual Studio Code Marketplace")
[![Latest Version](https://badgen.net/github/release/GehDoc/vscode-textile-preview?icon=github)](https://github.com/GehDoc/vscode-textile-preview/releases "View releases on GitHub")
[![Build Status](https://travis-ci.com/GehDoc/vscode-textile-preview.svg?branch=master)](https://travis-ci.com/GehDoc/vscode-textile-preview)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/3273/badge)](https://bestpractices.coreinfrastructure.org/projects/3273)  
Preview and rich language support, for the [Textile markup language](https://textile-lang.com/).

You can split your screen vertically, and keep the Textile source code side by side with the preview. The preview is updated as you type, and stays synchronized with the source code when you scroll.

As this extension is based on the [Visual Studio Code's Markdown Language Features](https://github.com/microsoft/vscode/tree/master/extensions/markdown-language-features), it provides **[MUCH MORE than a preview](#features)**.  
It relies on [a modified version of textile.js Textile parser](https://github.com/GehDoc/textile-js) in order to display a WYSIWYG preview of your textile document.

## Installation

### From Marketplace within VS Code

Launch VS Code Quick Open (<kbd>Ctrl+P</kbd>), paste the following command, and press <kbd>enter</kbd> :
```
ext install GehDoc.vscode-textile-preview
```

### From Marketplace with CLI

In your favorite shell, the following command will download and install the extension :
```bash
code --install-extension GehDoc.vscode-textile-preview
```

### From Github

Download the packaged extension from the [release page](https://github.com/GehDoc/vscode-textile-preview/releases) and install it from the command line :
```bash
code --install-extension path/to/vscode-textile-preview-*.vsix
```

## Working with Textile

Create or open any file with a .textile extension, and then you can toggle the visualization of the editor between the code and the preview of the Textile file.
To switch between views, press (<kbd>Ctrl+Shift+V</kbd>) in the editor. You can view the preview side-by-side (<kbd>Ctrl+K</kbd> <kbd>V</kbd>) with the file you are editing and see changes reflected in real-time as you edit.

![Demo](https://raw.githubusercontent.com/GehDoc/vscode-textile-preview/master/media/readme/01-03-2020%2019:04:25.webm.gif)

## Features

This extension is entirely based on the Markdown preview provided by Visual Studio Code, and offers the same level of functionality :
* view Textile source and its HTML preview side by side, with synchronised scrolling;
* include images, from local or network, with manageable security of the preview's content;
* click on links, in the source view and in the HTML preview.  
Internal and external links to a paragraph headline of a textile file are supported (slugify);
* see the document headlines structure in the outline view;
* fold paragraphs from their headline, multi-line list-items, code blocks, and special HTML comments `<!-- #region [Optional text] -->` and `<!-- #endregion [Optional text] -->`.
* blockquote syntax coloring, with `bc[language].` or `<pre><code class="language">`, or `<pre><code lang="language">`.  
Look at the official highlight.js documentation for the [list of supported languages](https://highlightjs.org/static/demo/).

And also :
* the HTML preview supports VSCode light and dark themes;
* the extension is translated into the [9 VSCode core languages](https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs).

### Missing features

Some features of the original Markdown preview have been disabled. 
To see the full list of features and interactions, you can read the documentation of the [Visual Studio Code's Markdown Language Features](https://code.visualstudio.com/docs/languages/markdown#_markdown-preview).

Features considered out of scope of this extension :
* Textile code snippets / Source syntax coloring : You have to use [other extensions from the marketplace](https://marketplace.visualstudio.com/search?term=textile&target=VSCode&category=All%20categories&sortBy=Relevance) for these purposes;
* Support plugins, like Mardown-it : Need antother textile to HTML engine;
* Telemetry reporter : Need a non free Azure account : https://www.npmjs.com/package/vscode-extension-telemetry

Maybe implemented, if requested :
* Add other translations than the 9 core languages listed there : https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs
* Support enabling/disabling 'linkify' = Enable or disable conversion of URL-like text to links in the Textile preview;
* Some helper functionalities, like link normalization and validation (may allow file:// protocol and absolute paths to images. Currently, http:// protocol, and path relative to Textile file are recognized). Look [here](./src/textileEngine.ts), and search for Disabled and FIXME;
* Support for integration into [Codespaces browser based editor](https://code.visualstudio.com/api/advanced-topics/remote-extensions);
* Smart select.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Roadmap

All [bugs and enhancements](https://github.com/GehDoc/vscode-textile-preview/issues) are tagged, and will be processed ASAP. Feel free to contribute !

## Supporting

* Give feedback and rating through [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview).
* Add stars to [the project on github](https://github.com/GehDoc/vscode-textile-preview ) if you like it !
* Financially sponsor our project [here](https://www.patreon.com/geraldhameau), or through the GitHub ❤ sponsor button on [the project's repository](https://github.com/GehDoc/vscode-textile-preview/).

Your support is greatly appreciated !

## Contributing

* [Submit bugs and feature requests](https://github.com/GehDoc/vscode-textile-preview/issues), and help us verify as they are checked in;
* Fix issues and contribute to the code.

Before contributing, take the time to read [the contributing guide](CONTRIBUTING.md).

## License

This project is licensed under the terms of the [MIT license](./LICENSE.txt).

It is entirely based on :
* [Visual Studio Code's Markdown Language Features](https://github.com/Microsoft/vscode/tree/master/extensions/markdown-language-features) under the terms of the [MIT license](LICENSES/vscode-LICENSE.txt).
* and, the [Visual Studio Code Language Packs](https://github.com/microsoft/vscode-loc) under the terms of the [MIT license](LICENSES/vscode-loc-LICENSE.md).

It includes a modified version of [textile-js](https://github.com/GehDoc/textile-js) under the terms of the [MIT license](LICENSES/textile-js-LICENSE.txt).

The Textile logo mark is from [Textile logo marks](https://github.com/textile/textile-mark) under [Creative Commons CC0 1.0 Universal (CC0 1.0) License](https://creativecommons.org/publicdomain/zero/1.0/legalcode).
