# Contributing to Textile Language Features

## Feedback

We're interested in your feedback for the future of this extension :
* You can submit a suggestion or feature request through [the issue tracker](https://github.com/GehDoc/vscode-textile-preview/issues).
* You can give feedback and rating through the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GehDoc.vscode-textile-preview).


## Reporting issues

Have you identified a reproducible problem ? Have a feature request ?
Here's how you can make reporting your issue as effective as possible.

### Security issue ?

If you believe you have discovered a vulnerability in Textile Language Features, or have a security incident to report, follow the instructions in [./SECURITY.md](./SECURITY.md).

### Look for an existing issue

Before you create a new issue, please do a search in [open issues](https://github.com/GehDoc/vscode-textile-preview/issues) to see if the issue or feature request has already been filed.

If you find your issue already exists, make relevant comments and [add your reaction](https://github.blog/2016-03-10-add-reactions-to-pull-requests-issues-and-comments/). Use a reaction in place of a "+1" comment:
* :+1: - upvote
* :-1: - downvote

If you cannot find an existing issue that describes your bug or feature, create a new issue using the guidelines below.

### Writing good bug reports and feature requests

File a single issue per problem and feature request. Do not enumerate multiple bugs or feature requests in the same issue.

Do not add your issue as a comment to an existing issue unless it's for the identical input. Many issues look similar, but have different causes.

The more information you can provide, the more likely someone will be successful at reproducing the issue and finding a fix.

Please include the following with each issue:
* Version of Textile Language Features
* Version of VS Code
* Your operating system
* Describe the bug
* Reproducible steps (1... 2... 3...) that cause the issue
* What you expected to see, versus what you actually saw
* If relevant :
	* Images, animations, or a link to a video showing the issue occurring
	* A code snippet that demonstrates the issue or a link to a code repository the developers can easily pull down to recreate the issue locally  
	*Note:* Because the developers need to copy and paste the code snippet, including a code snippet as a media file (i.e. .gif) is not sufficient.
	* Errors from the Dev Tools Console (open from the menu: Help > Toggle Developer Tools)

### Follow your issue

Once submitted, your report will go into a standard issue tracking workflow. You can continue to assist throughout the process, by :
* providing additionnal informations, if developpers ask for.
* and, by giving a confirmation when the issue is solved.

### Go further

Textile Language Feature entirely rely on two projects. After reporting an issue to Textile Language Features repository, you can check if it impacts those projects.

In that case, you can :
* read the corresponding project's contributing guide,
* find the corresponding issue, or report a new one there,
* And, add a comment to your issue in Textile Language Features repository, with a link to the issue on the corresponding project's repository. 

The two relevant projects are :

#### Visual Studio Code Markdown Language Feature

If you can reproduce the same issue in Visual Studio Code by [editing a markdown file](https://code.visualstudio.com/docs/languages/markdown#_markdown-preview), then you can submit the same issue to [Visual Studio Code repository](https://github.com/microsoft/vscode/issues).

#### Textile.js 

We maintain a [modified textile.js library](https://github.com/GehDoc/textile-js), and a [textile live web editor](https://gehdoc.github.io/textile-js/) is available to easily test your markups.

If you can reproduce the same issue in the [textile live web editor](https://gehdoc.github.io/textile-js/) by copy / pasting your Textile source to it, then you can submit the same issue to our [modified textile.js library repository](https://github.com/GehDoc/textile-js/issues).

## Translations

Translations are automatically imported from [Visual Studio Code language packs](https://github.com/microsoft/vscode-loc/) site, and adapted to Textile language Feature trough simples search and replace patterns.
We will accept only simple corrections of the existing [import tool](#Update-to-latest-Visual-Studio-Code-sources-and-translations), and we will refuse any translation change or improvement.

If you want to improve translations, please contribute to the [Visual Studio Code Community Localization Project](https://github.com/Microsoft/Localization/wiki/Visual-Studio-Code-Community-Localization-Project) instead.

_Please note :_ An exception to this rule was made for the default description of the package.

## Contributing fixes

### Prerequisites
* Latest [Visual Studio Code](https://code.visualstudio.com/)
* [Node.js](https://nodejs.org/) v12.0.0 or higher

### Setup
1. Fork and clone [the repository](https://github.com/GehDoc/vscode-textile-preview/)
2. `cd vscode-textile-preview`
3. Install the dependencies: `npm install`
4. Open the folder in VS Code
5. Open to the "Run and Debug" Window (Ctrl+Shift+D), and launch Tests or Extension.

### While coding
As this extension share its code base with VSCode Mardown Language Features, it is important to identify easily which parts have been changed. So, while coding, you should ensure to have comments around each modified source code block, either :
* "Modified for textile" or "Changed for textile",
* "Disabled for textile",
* "Keep for textile", when some code is removed from VSCode source tree, but should be kept for Texile,
* or, "Added for texile".

You are free to add "FIXME" comments, when something should be fixed.

### Commit
In order to keep the commit log understandable, you have to look first at the commit history to see how to group files and write commit messages the same way.

### Test
Before submitting Pull Requests, make sure you have :
* no linting error
* and, all tests passing :
	* Open to the "Run and Debug" Window (Ctrl+Shift+D), and choose "Launch Tests" from the dropdown menu.
	* or, check the Travis-CI build status, if enabled in your repository.

When you add new functionalities, the tests corresponding to this new functionality must be added to the test suite.

### Update to latest Visual Studio Code sources and translations
A shell script [./tools/prepare_vscode_tree.sh](./tools/prepare_vscode_tree.sh), will help you to update Textile Language Features source code, from VSCode Makdown Language Features source code. Ideally, this will be done every time [a new version of VSCode](https://github.com/microsoft/vscode/releases) is published.

It doesn't accept any command line parameter. You can still configure :
* the current VSCode release version, with the variable `VSCODE_VERSION_GIT_TAG`,
* the list of supported languages, in the [./tools/languages.config.js](./tools/languages.config.js) file.

The script will automatically :
* Fetch [vscode](https://github.com/microsoft/vscode/) and [vscode-loc](https://github.com/microsoft/vscode-loc/) from their GitHub repo, into [./tools/tmp/](./tools/tmp/),
* Replace 'Markdown' by 'Textile' in VSCode Markdown Language Features source tree, and validate the number of replacements (see [./tools/languages.config.js](./tools/languages.config.js)),
* Then, all needed files are renamed if necessary and copied to [./tools/tmp/out/](./tools/tmp/out/) directory.

Finally, you have to manually import the relevant changes, by diffing the root directory with [./tools/tmp/out/](./tools/tmp/out/).

## Discussion etiquette

In order to keep the conversation clear and transparent, please limit discussion to English and keep things on topic with the issue. Be considerate to others and try to be courteous and professional at all times.


## Thank You !