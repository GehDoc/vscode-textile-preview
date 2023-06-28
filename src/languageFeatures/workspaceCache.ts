/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';
import { Lazy, lazy } from '../util/lazy';
import { TextileWorkspaceContents, SkinnyTextDocument } from '../workspaceContents';

/**
 * Cache of information for textile files in the workspace.
 */
export class TextileWorkspaceCache<T> extends Disposable {

	private readonly _cache = new Map<string, Lazy<Promise<T>>>();
	private _hasPopulatedCache = false;

	public constructor(
		private readonly workspaceContents: TextileWorkspaceContents,
		private readonly getValue: (document: SkinnyTextDocument) => Promise<T>,
	) {
		super();
	}

	public async getAll(): Promise<T[]> {
		if (!this._hasPopulatedCache) {
			await this.populateCache();
			this._hasPopulatedCache = true;

			this.workspaceContents.onDidChangeTextileDocument(this.onDidChangeDocument, this, this._disposables);
			this.workspaceContents.onDidCreateTextileDocument(this.onDidChangeDocument, this, this._disposables);
			this.workspaceContents.onDidDeleteTextileDocument(this.onDidDeleteDocument, this, this._disposables);
		}

		return Promise.all(Array.from(this._cache.values(), x => x.value));
	}

	private async populateCache(): Promise<void> {
		const textileDocumentUris = await this.workspaceContents.getAllTextileDocuments();
		for (const document of textileDocumentUris) {
			this.update(document);
		}
	}

	private key(resource: vscode.Uri): string {
		return resource.toString();
	}

	private update(document: SkinnyTextDocument): void {
		this._cache.set(this.key(document.uri), lazy(() => this.getValue(document)));
	}

	private onDidChangeDocument(document: SkinnyTextDocument) {
		this.update(document);
	}

	private onDidDeleteDocument(resource: vscode.Uri) {
		this._cache.delete(this.key(resource));
	}
}
