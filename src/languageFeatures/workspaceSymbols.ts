/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';
import { TextileWorkspaceInfoCache } from '../util/workspaceCache';
import { ITextileWorkspace } from '../workspace';
import { TextileDocumentSymbolProvider } from './documentSymbols';

export class TextileWorkspaceSymbolProvider extends Disposable implements vscode.WorkspaceSymbolProvider {

	private readonly _cache: TextileWorkspaceInfoCache<vscode.SymbolInformation[]>;

	public constructor(
		symbolProvider: TextileDocumentSymbolProvider,
		workspace: ITextileWorkspace,
	) {
		super();

		this._cache = this._register(new TextileWorkspaceInfoCache(workspace, doc => symbolProvider.provideDocumentSymbolInformation(doc)));
	}

	public async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
		const allSymbols = (await this._cache.values()).flat();
		return allSymbols.filter(symbolInformation => symbolInformation.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
	}
}

export function registerWorkspaceSymbolSupport(
	workspace: ITextileWorkspace,
	symbolProvider: TextileDocumentSymbolProvider,
): vscode.Disposable {
	return vscode.languages.registerWorkspaceSymbolProvider(new TextileWorkspaceSymbolProvider(symbolProvider, workspace));
}
