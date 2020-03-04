/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';
import { isTextileFile } from '../util/file';
import { Lazy, lazy } from '../util/lazy';
import TextileDocumentSymbolProvider from './documentSymbolProvider';
import { SkinnyTextDocument, SkinnyTextLine } from '../tableOfContentsProvider';
import { flatten } from '../util/arrays';

export interface WorkspaceTextileDocumentProvider {
	getAllTextileDocuments(): Thenable<Iterable<SkinnyTextDocument>>;

	readonly onDidChangeTextileDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidCreateTextileDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidDeleteTextileDocument: vscode.Event<vscode.Uri>;
}

class VSCodeWorkspaceTextileDocumentProvider extends Disposable implements WorkspaceTextileDocumentProvider {

	private readonly _onDidChangeTextileDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidCreateTextileDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidDeleteTextileDocumentEmitter = this._register(new vscode.EventEmitter<vscode.Uri>());

	private _watcher: vscode.FileSystemWatcher | undefined;

	async getAllTextileDocuments() {
		const resources = await vscode.workspace.findFiles('**/*.textile', '**/node_modules/**'); // changed for textile
		const docs = await Promise.all(resources.map(doc => this.getTextileDocument(doc)));
		return docs.filter(doc => !!doc) as SkinnyTextDocument[];
	}

	public get onDidChangeTextileDocument() {
		this.ensureWatcher();
		return this._onDidChangeTextileDocumentEmitter.event;
	}

	public get onDidCreateTextileDocument() {
		this.ensureWatcher();
		return this._onDidCreateTextileDocumentEmitter.event;
	}

	public get onDidDeleteTextileDocument() {
		this.ensureWatcher();
		return this._onDidDeleteTextileDocumentEmitter.event;
	}

	private ensureWatcher(): void {
		if (this._watcher) {
			return;
		}

		this._watcher = this._register(vscode.workspace.createFileSystemWatcher('**/*.textile')); // changed for textile

		this._watcher.onDidChange(async resource => {
			const document = await this.getTextileDocument(resource);
			if (document) {
				this._onDidChangeTextileDocumentEmitter.fire(document);
			}
		}, null, this._disposables);

		this._watcher.onDidCreate(async resource => {
			const document = await this.getTextileDocument(resource);
			if (document) {
				this._onDidCreateTextileDocumentEmitter.fire(document);
			}
		}, null, this._disposables);

		this._watcher.onDidDelete(async resource => {
			this._onDidDeleteTextileDocumentEmitter.fire(resource);
		}, null, this._disposables);

		vscode.workspace.onDidChangeTextDocument(e => {
			if (isTextileFile(e.document)) {
				this._onDidChangeTextileDocumentEmitter.fire(e.document);
			}
		}, null, this._disposables);
	}

	private async getTextileDocument(resource: vscode.Uri): Promise<SkinnyTextDocument | undefined> {
		const matchingDocuments = vscode.workspace.textDocuments.filter((doc) => doc.uri.toString() === resource.toString());
		if (matchingDocuments.length !== 0) {
			return matchingDocuments[0];
		}

		const bytes = await vscode.workspace.fs.readFile(resource);

		// We assume that textile is in UTF-8
		const text = Buffer.from(bytes).toString('utf-8');

		const lines: SkinnyTextLine[] = [];
		const parts = text.split(/(\r?\n)/);
		const lineCount = Math.floor(parts.length / 2) + 1;
		for (let line = 0; line < lineCount; line++) {
			lines.push({
				text: parts[line * 2]
			});
		}

		return {
			uri: resource,
			version: 0,
			lineCount: lineCount,
			lineAt: (index) => {
				return lines[index];
			},
			getText: () => {
				return text;
			}
		};
	}
}

export default class TextileWorkspaceSymbolProvider extends Disposable implements vscode.WorkspaceSymbolProvider {
	private _symbolCache = new Map<string, Lazy<Thenable<vscode.SymbolInformation[]>>>();
	private _symbolCachePopulated: boolean = false;

	public constructor(
		private _symbolProvider: TextileDocumentSymbolProvider,
		private _workspaceTextileDocumentProvider: WorkspaceTextileDocumentProvider = new VSCodeWorkspaceTextileDocumentProvider()
	) {
		super();
	}

	public async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
		if (!this._symbolCachePopulated) {
			await this.populateSymbolCache();
			this._symbolCachePopulated = true;

			this._workspaceTextileDocumentProvider.onDidChangeTextileDocument(this.onDidChangeDocument, this, this._disposables);
			this._workspaceTextileDocumentProvider.onDidCreateTextileDocument(this.onDidChangeDocument, this, this._disposables);
			this._workspaceTextileDocumentProvider.onDidDeleteTextileDocument(this.onDidDeleteDocument, this, this._disposables);
		}

		const allSymbolsSets = await Promise.all(Array.from(this._symbolCache.values()).map(x => x.value));
		const allSymbols = flatten(allSymbolsSets);
		return allSymbols.filter(symbolInformation => symbolInformation.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
	}

	public async populateSymbolCache(): Promise<void> {
		const textileDocumentUris = await this._workspaceTextileDocumentProvider.getAllTextileDocuments();
		for (const document of textileDocumentUris) {
			this._symbolCache.set(document.uri.fsPath, this.getSymbols(document));
		}
	}

	private getSymbols(document: SkinnyTextDocument): Lazy<Thenable<vscode.SymbolInformation[]>> {
		return lazy(async () => {
			return this._symbolProvider.provideDocumentSymbolInformation(document);
		});
	}

	private onDidChangeDocument(document: SkinnyTextDocument) {
		this._symbolCache.set(document.uri.fsPath, this.getSymbols(document));
	}

	private onDidDeleteDocument(resource: vscode.Uri) {
		this._symbolCache.delete(resource.fsPath);
	}
}
