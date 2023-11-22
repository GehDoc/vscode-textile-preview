/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ITextDocument } from '../types/textDocument';
import { Disposable } from '../util/dispose';
import { ResourceMap } from '../util/resourceMap';
import { ITextileWorkspace } from '../workspace';


export class InMemoryTextileWorkspace extends Disposable implements ITextileWorkspace {
	private readonly _documents = new ResourceMap<ITextDocument>(uri => uri.fsPath);

	constructor(documents: ITextDocument[]) {
		super();
		for (const doc of documents) {
			this._documents.set(doc.uri, doc);
		}
	}

	public values() {
		return Array.from(this._documents.values());
	}

	public async getAllTextileDocuments() {
		return this.values();
	}

	public async getOrLoadTextileDocument(resource: vscode.Uri): Promise<ITextDocument | undefined> {
		return this._documents.get(resource);
	}

	public hasTextileDocument(resolvedHrefPath: vscode.Uri): boolean {
		return this._documents.has(resolvedHrefPath);
	}

	public async pathExists(resource: vscode.Uri): Promise<boolean> {
		return this._documents.has(resource);
	}

	public async readDirectory(resource: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const files = new Map<string, vscode.FileType>();
		const pathPrefix = resource.fsPath + (resource.fsPath.endsWith('/') || resource.fsPath.endsWith('\\') ? '' : path.sep);
		for (const doc of this._documents.values()) {
			const path = doc.uri.fsPath;
			if (path.startsWith(pathPrefix)) {
				const parts = path.slice(pathPrefix.length).split(/\/|\\/g);
				files.set(parts[0], parts.length > 1 ? vscode.FileType.Directory : vscode.FileType.File);
			}
		}
		return Array.from(files.entries());
	}

	private readonly _onDidChangeTextileDocumentEmitter = this._register(new vscode.EventEmitter<ITextDocument>());
	public onDidChangeTextileDocument = this._onDidChangeTextileDocumentEmitter.event;

	private readonly _onDidCreateTextileDocumentEmitter = this._register(new vscode.EventEmitter<ITextDocument>());
	public onDidCreateTextileDocument = this._onDidCreateTextileDocumentEmitter.event;

	private readonly _onDidDeleteTextileDocumentEmitter = this._register(new vscode.EventEmitter<vscode.Uri>());
	public onDidDeleteTextileDocument = this._onDidDeleteTextileDocumentEmitter.event;

	public updateDocument(document: ITextDocument) {
		this._documents.set(document.uri, document);
		this._onDidChangeTextileDocumentEmitter.fire(document);
	}

	public createDocument(document: ITextDocument) {
		assert.ok(!this._documents.has(document.uri));

		this._documents.set(document.uri, document);
		this._onDidCreateTextileDocumentEmitter.fire(document);
	}

	public deleteDocument(resource: vscode.Uri) {
		this._documents.delete(resource);
		this._onDidDeleteTextileDocumentEmitter.fire(resource);
	}
}
