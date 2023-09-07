/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import { TextileWorkspaceContents, SkinnyTextDocument } from '../workspaceContents';


export class InMemoryWorkspaceTextileDocuments implements TextileWorkspaceContents {
	private readonly _documents = new Map<string, SkinnyTextDocument>();

	constructor(documents: SkinnyTextDocument[]) {
		for (const doc of documents) {
			this._documents.set(this.getKey(doc.uri), doc);
		}
	}

	public async getAllTextileDocuments() {
		return Array.from(this._documents.values());
	}

	public async getTextileDocument(resource: vscode.Uri): Promise<SkinnyTextDocument | undefined> {
		return this._documents.get(this.getKey(resource));
	}

	public async pathExists(resource: vscode.Uri): Promise<boolean> {
		return this._documents.has(this.getKey(resource));
	}
	private readonly _onDidChangeTextileDocumentEmitter = new vscode.EventEmitter<SkinnyTextDocument>();
	public onDidChangeTextileDocument = this._onDidChangeTextileDocumentEmitter.event;

	private readonly _onDidCreateTextileDocumentEmitter = new vscode.EventEmitter<SkinnyTextDocument>();
	public onDidCreateTextileDocument = this._onDidCreateTextileDocumentEmitter.event;

	private readonly _onDidDeleteTextileDocumentEmitter = new vscode.EventEmitter<vscode.Uri>();
	public onDidDeleteTextileDocument = this._onDidDeleteTextileDocumentEmitter.event;

	public updateDocument(document: SkinnyTextDocument) {
		this._documents.set(this.getKey(document.uri), document);
		this._onDidChangeTextileDocumentEmitter.fire(document);
	}

	public createDocument(document: SkinnyTextDocument) {
		assert.ok(!this._documents.has(this.getKey(document.uri)));

		this._documents.set(this.getKey(document.uri), document);
		this._onDidCreateTextileDocumentEmitter.fire(document);
	}

	public deleteDocument(resource: vscode.Uri) {
		this._documents.delete(this.getKey(resource));
		this._onDidDeleteTextileDocumentEmitter.fire(resource);
	}

	private getKey(resource: vscode.Uri): string {
		return resource.fsPath;
	}
}
