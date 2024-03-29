/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as URI from 'vscode-uri';

const textileFileExtensions = Object.freeze<string[]>([
	'.textile',
]);

export function isTextileFile(document: vscode.TextDocument) {
	return document.languageId === 'textile';
}

export function looksLikeTextilePath(resolvedHrefPath: vscode.Uri) {
	return textileFileExtensions.includes(URI.Utils.extname(resolvedHrefPath).toLowerCase());
}
