/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILogger } from '../logging';
import { TextileTableOfContentsProvider, TocEntry } from '../tableOfContents';
import { ITextDocument } from '../types/textDocument';

interface TextileSymbol {
	readonly level: number;
	readonly parent: TextileSymbol | undefined;
	readonly children: vscode.DocumentSymbol[];
}

export class TextileDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

	constructor(
		private readonly tocProvider: TextileTableOfContentsProvider,
		private readonly logger: ILogger,
	) { }

	public async provideDocumentSymbolInformation(document: ITextDocument): Promise<vscode.SymbolInformation[]> {
		this.logger.verbose('DocumentSymbolProvider', `provideDocumentSymbolInformation - ${document.uri}`);
		const toc = await this.tocProvider.getForDocument(document);
		return toc.entries.map(entry => this.toSymbolInformation(entry));
	}

	public async provideDocumentSymbols(document: ITextDocument): Promise<vscode.DocumentSymbol[]> {
		const toc = await this.tocProvider.getForDocument(document);
		const root: TextileSymbol = {
			level: -Infinity,
			children: [],
			parent: undefined
		};
		this.buildTree(root, toc.entries);
		return root.children;
	}

	private buildTree(parent: TextileSymbol, entries: readonly TocEntry[]) {
		if (!entries.length) {
			return;
		}

		const entry = entries[0];
		const symbol = this.toDocumentSymbol(entry);
		symbol.children = [];

		while (entry.level <= parent.level) {
			parent = parent.parent!;
		}
		parent.children.push(symbol);
		this.buildTree({ level: entry.level, children: symbol.children, parent }, entries.slice(1));
	}

	private toSymbolInformation(entry: TocEntry): vscode.SymbolInformation {
		return new vscode.SymbolInformation(
			this.getSymbolName(entry),
			vscode.SymbolKind.String,
			'',
			entry.sectionLocation);
	}

	private toDocumentSymbol(entry: TocEntry) {
		return new vscode.DocumentSymbol(
			this.getSymbolName(entry),
			'',
			vscode.SymbolKind.String,
			entry.sectionLocation.range,
			entry.sectionLocation.range);
	}

	private getSymbolName(entry: TocEntry): string {
		return 'h' + entry.level + '. ' + entry.text; // changed for Textile
	}
}

export function registerDocumentSymbolSupport(
	selector: vscode.DocumentSelector,
	tocProvider: TextileTableOfContentsProvider,
	logger: ILogger,
): vscode.Disposable {
	return vscode.languages.registerDocumentSymbolProvider(selector, new TextileDocumentSymbolProvider(tocProvider, logger));
}
