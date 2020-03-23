/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TextileEngine } from '../textileEngine';
import { TextileContributionProvider, TextileContributions } from '../textileExtensions';
import { githubSlugifier } from '../slugify';
import { Disposable } from '../util/dispose';

const emptyContributions = new class extends Disposable implements TextileContributionProvider {
	readonly extensionPath = '';
	readonly contributions = TextileContributions.Empty;
	readonly onContributionsChanged = this._register(new vscode.EventEmitter<this>()).event;
};

export function createNewTextileEngine(): TextileEngine {
	return new TextileEngine(emptyContributions, githubSlugifier);
}
