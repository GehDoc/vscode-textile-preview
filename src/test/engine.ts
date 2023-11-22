/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TextileJSEngine } from '../textileEngine';
import { TextileContributionProvider, TextileContributions } from '../textileExtensions';
import { githubSlugifier } from '../slugify';
import { Disposable } from '../util/dispose';
import { nulLogger } from './nulLogging';

const emptyContributions = new class extends Disposable implements TextileContributionProvider {
	readonly extensionUri = vscode.Uri.file('/');
	readonly contributions = TextileContributions.Empty;
	readonly onContributionsChanged = this._register(new vscode.EventEmitter<this>()).event;
};

export function createNewTextileEngine(): TextileJSEngine {
	return new TextileJSEngine(emptyContributions, githubSlugifier, nulLogger);
}
