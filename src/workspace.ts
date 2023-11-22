/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ITextDocument } from './types/textDocument';
import { coalesce } from './util/arrays';
import { Disposable } from './util/dispose';
import { isTextileFile, looksLikeTextilePath } from './util/file';
import { InMemoryDocument } from './util/inMemoryDocument';
import { Limiter } from './util/limiter';
import { ResourceMap } from './util/resourceMap';

/**
 * Provides set of textile files in the current workspace.
 */
export interface ITextileWorkspace {
	/**
	 * Get list of all known textile files.
	 */
	getAllTextileDocuments(): Promise<Iterable<ITextDocument>>;

	/**
	 * Check if a document already exists in the workspace contents.
	 */
	hasTextileDocument(resource: vscode.Uri): boolean;

	getOrLoadTextileDocument(resource: vscode.Uri): Promise<ITextDocument | undefined>;

	pathExists(resource: vscode.Uri): Promise<boolean>;

	readDirectory(resource: vscode.Uri): Promise<[string, vscode.FileType][]>;

	readonly onDidChangeTextileDocument: vscode.Event<ITextDocument>;
	readonly onDidCreateTextileDocument: vscode.Event<ITextDocument>;
	readonly onDidDeleteTextileDocument: vscode.Event<vscode.Uri>;
}

/**
 * Provides set of textile files known to VS Code.
 *
 * This includes both opened text documents and textile files in the workspace.
 */
export class VsCodeTextileWorkspace extends Disposable implements ITextileWorkspace {

	private readonly _onDidChangeTextileDocumentEmitter = this._register(new vscode.EventEmitter<ITextDocument>());
	private readonly _onDidCreateTextileDocumentEmitter = this._register(new vscode.EventEmitter<ITextDocument>());
	private readonly _onDidDeleteTextileDocumentEmitter = this._register(new vscode.EventEmitter<vscode.Uri>());

	private _watcher: vscode.FileSystemWatcher | undefined;

	private readonly _documentCache = new ResourceMap<ITextDocument>();

	private readonly utf8Decoder = new TextDecoder('utf-8');

	/**
	 * Reads and parses all .textile documents in the workspace.
	 * Files are processed in batches, to keep the number of open files small.
	 *
	 * @returns Array of processed .textile files.
	 */
	async getAllTextileDocuments(): Promise<ITextDocument[]> {
		const maxConcurrent = 20;

		const foundFiles = new ResourceMap<void>();
		const limiter = new Limiter<ITextDocument | undefined>(maxConcurrent);

		// Add files on disk
		const resources = await vscode.workspace.findFiles('**/*.textile', '**/node_modules/**');
		const onDiskResults = await Promise.all(resources.map(resource => {
			return limiter.queue(async () => {
				const doc = await this.getOrLoadTextileDocument(resource);
				if (doc) {
					foundFiles.set(resource);
				}
				return doc;
			});
		}));

		// Add opened files (such as untitled files)
		const openTextDocumentResults = await Promise.all(vscode.workspace.textDocuments
			.filter(doc => !foundFiles.has(doc.uri) && this.isRelevantTextileDocument(doc)));

		return coalesce([...onDiskResults, ...openTextDocumentResults]);
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

		this._watcher = this._register(vscode.workspace.createFileSystemWatcher('**/*.textile'));

		this._register(this._watcher.onDidChange(async resource => {
			this._documentCache.delete(resource);
			const document = await this.getOrLoadTextileDocument(resource);
			if (document) {
				this._onDidChangeTextileDocumentEmitter.fire(document);
			}
		}));

		this._register(this._watcher.onDidCreate(async resource => {
			const document = await this.getOrLoadTextileDocument(resource);
			if (document) {
				this._onDidCreateTextileDocumentEmitter.fire(document);
			}
		}));

		this._register(this._watcher.onDidDelete(resource => {
			this._documentCache.delete(resource);
			this._onDidDeleteTextileDocumentEmitter.fire(resource);
		}));

		this._register(vscode.workspace.onDidOpenTextDocument(e => {
			this._documentCache.delete(e.uri);
			if (this.isRelevantTextileDocument(e)) {
				this._onDidCreateTextileDocumentEmitter.fire(e);
			}
		}));

		this._register(vscode.workspace.onDidChangeTextDocument(e => {
			if (this.isRelevantTextileDocument(e.document)) {
				this._onDidChangeTextileDocumentEmitter.fire(e.document);
			}
		}));

		this._register(vscode.workspace.onDidCloseTextDocument(e => {
			this._documentCache.delete(e.uri);
		}));
	}

	private isRelevantTextileDocument(doc: vscode.TextDocument) {
		return isTextileFile(doc) && doc.uri.scheme !== 'vscode-bulkeditpreview';
	}

	public async getOrLoadTextileDocument(resource: vscode.Uri): Promise<ITextDocument | undefined> {
		const existing = this._documentCache.get(resource);
		if (existing) {
			return existing;
		}

		const matchingDocument = vscode.workspace.textDocuments.find((doc) => this.isRelevantTextileDocument(doc) && doc.uri.toString() === resource.toString());
		if (matchingDocument) {
			this._documentCache.set(resource, matchingDocument);
			return matchingDocument;
		}

		if (!looksLikeTextilePath(resource)) {
			return undefined;
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(resource);

			// We assume that textile is in UTF-8
			const text = this.utf8Decoder.decode(bytes);
			const doc = new InMemoryDocument(resource, text, 0);
			this._documentCache.set(resource, doc);
			return doc;
		} catch {
			return undefined;
		}
	}

	public hasTextileDocument(resolvedHrefPath: vscode.Uri): boolean {
		return this._documentCache.has(resolvedHrefPath);
	}

	public async pathExists(target: vscode.Uri): Promise<boolean> {
		let targetResourceStat: vscode.FileStat | undefined;
		try {
			targetResourceStat = await vscode.workspace.fs.stat(target);
		} catch {
			return false;
		}
		return targetResourceStat.type === vscode.FileType.File || targetResourceStat.type === vscode.FileType.Directory;
	}

	public async readDirectory(resource: vscode.Uri): Promise<[string, vscode.FileType][]> {
		return vscode.workspace.fs.readDirectory(resource);
	}
}
