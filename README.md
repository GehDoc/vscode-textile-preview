# Textile Language Features

[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version-short/GehDoc.vscode-textile-preview.svg)](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview "View this project on Visual Studio Code Marketplace")
[![Build Status](https://travis-ci.org/GehDoc/vscode-textile-preview.svg?branch=master)](https://travis-ci.org/GehDoc/vscode-textile-preview)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/3273/badge)](https://bestpractices.coreinfrastructure.org/projects/3273)  

Full featured document live preview and rich language support, for the [Textile markup language](https://textile-lang.com/).

Based on the source code of [Visual Studio Code's Markdown Language Features](https://github.com/microsoft/vscode/tree/master/extensions/markdown-language-features), it uses [a modified version of textile.js Textile parser](https://github.com/GehDoc/textile-js) in order to display the live preview.

## Working with Textile

Create or open any file with a .textile extension, and then you can toggle the visualization of the editor between the code and the preview of the Textile file.
To switch between views, press (<kbd>Ctrl+Shift+V</kbd>) in the editor. You can view the preview side-by-side (<kbd>Ctrl+K</kbd> <kbd>V</kbd>) with the file you are editing and see changes reflected in real-time as you edit.

![Demo](https://raw.githubusercontent.com/GehDoc/vscode-textile-preview/master/media/readme/01-03-2020%2019:04:25.webm.gif)

## Features

This extension is entirely based on the Markdown preview provided by Visual Studio Code, and tries to offer the same functionalities :
* you can view Textile source and its HTML preview side by side, with synchronised scrolling;
* you can include images, from local or network, with manageable security of the preview's content;
* you can click on links, in the source view and in the HTML preview;
* the HTML preview supports VSCode light and dark themes;
* the extension is translated into the 9 VScode core languages;

### Missing features

For now, some features of the original Markdown preview have been disabled. 
To see the full list of features and interactions, you can read the documentation of the [Visual Studio Code's Markdown Language Features](https://code.visualstudio.com/docs/languages/markdown#_markdown-preview).

Features to be implemented :
* Paragraph folding;
* Generation of table of content, and table of symbols;
* Support slugify : Allow internal and external links to a paragraph header of a textile file;
* Blockquote syntax coloring.

Features considered out of scope of this extension :
* Snippets / Source syntax coloring : You have to use another extensions for these purpose.
* Support plugins, like mardown-it : Need antother textile to HTML engine
* Telemetry Reporter : Need a non free Azure account : https://www.npmjs.com/package/vscode-extension-telemetry

Maybe implemented, if requested :
* Add other translations than the 9 core languages listed there : https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs
* Support enabling/disabling 'linkify' = Enable or disable conversion of URL-like text to links in the Textile preview.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Roadmap

All [bugs and enhancements](https://github.com/GehDoc/vscode-textile-preview/issues) are tagged. Mostly :
*  Implement missing features (see above), keep in sync with VSCode and Textile-JS updates, ...  
*  All remaining ToDOs and issues will be triaged and planned soon, now that the first release has been made available.

## Supporting

* Give feedback and rating through [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview).
* Financially sponsor our project [here](http://www.leetchi.com/c/vscode-textile-language-features), or through the GitHub ❤ sponsor button on [the project's repository](https://github.com/GehDoc/vscode-textile-preview/).

Your support is greatly appreciated !

## Contributing

* [Submit bugs and feature requests](https://github.com/GehDoc/vscode-textile-preview/issues), and help us verify as they are checked in.
* Fix issues and contribute to the code.

Before contributing, take the time to read [the contributing guide](CONTRIBUTING.md).

## License

This project is licensed under the terms of the [MIT license](./LICENSE.txt).

It is entirely based on :
* [Visual Studio Code's Markdown Language Features](https://github.com/Microsoft/vscode/tree/master/extensions/markdown-language-features) under the terms of the [MIT license](LICENSES/vscode-LICENSE.txt).  
* and, the [Visual Studio Code Language Packs](https://github.com/microsoft/vscode-loc) under the terms of the [MIT license](LICENSES/vscode-loc-LICENSE.md).

It includes a modified version of [textile-js](https://github.com/GehDoc/textile-js) under the terms of the [MIT license](LICENSES/textile-js-LICENSE.txt).

The Textile logo mark is from [Textile logo marks](https://github.com/textile/textile-mark) under [Creative Commons CC0 1.0 Universal (CC0 1.0) License](https://creativecommons.org/publicdomain/zero/1.0/legalcode).
