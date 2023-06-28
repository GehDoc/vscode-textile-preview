/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { Disposable } from '../util/dispose';
import { TextileWorkspaceContents } from '../workspaceContents';
import { TextileDocumentSymbolProvider } from './documentSymbolProvider';
import { TextileWorkspaceCache } from './workspaceCache';

export class TextileWorkspaceSymbolProvider extends Disposable implements vscode.WorkspaceSymbolProvider {

	private readonly _cache: TextileWorkspaceCache<vscode.SymbolInformation[]>;

	public constructor(
		symbolProvider: TextileDocumentSymbolProvider,
		workspaceContents: TextileWorkspaceContents,
	) {
		super();

		this._cache = this._register(new TextileWorkspaceCache(workspaceContents, doc => symbolProvider.provideDocumentSymbolInformation(doc)));
	}

	public async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
		const allSymbols = (await this._cache.getAll()).flat();
		return allSymbols.filter(symbolInformation => symbolInformation.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
	}
}
