/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { coalesce } from './util/arrays';
import { Disposable } from './util/dispose';
import { isTextileFile } from './util/file';
import { InMemoryDocument } from './util/inMemoryDocument';
import { Limiter } from './util/limiter';

/**
 * Minimal version of {@link vscode.TextLine}. Used for mocking out in testing.
 */
export interface SkinnyTextLine {
	readonly text: string;
	readonly isEmptyOrWhitespace: boolean;
}

/**
 * Minimal version of {@link vscode.TextDocument}. Used for mocking out in testing.
 */
export interface SkinnyTextDocument {
	readonly uri: vscode.Uri;
	readonly version: number;
	readonly lineCount: number;

	getText(range?: vscode.Range): string;
	lineAt(line: number): SkinnyTextLine;
	positionAt(offset: number): vscode.Position;
}

/**
 * Provides set of textile files in the current workspace.
 */
export interface TextileWorkspaceContents {
	/**
	 * Get list of all known textile files.
	 */
	getAllTextileDocuments(): Promise<Iterable<SkinnyTextDocument>>;

	getTextileDocument(resource: vscode.Uri): Promise<SkinnyTextDocument | undefined>;

	pathExists(resource: vscode.Uri): Promise<boolean>;
	readonly onDidChangeTextileDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidCreateTextileDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidDeleteTextileDocument: vscode.Event<vscode.Uri>;
}

/**
 * Provides set of textile files known to VS Code.
 *
 * This includes both opened text documents and textile files in the workspace.
 */
export class VsCodeTextileWorkspaceContents extends Disposable implements TextileWorkspaceContents {

	private readonly _onDidChangeTextileDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidCreateTextileDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidDeleteTextileDocumentEmitter = this._register(new vscode.EventEmitter<vscode.Uri>());

	private _watcher: vscode.FileSystemWatcher | undefined;

	private readonly utf8Decoder = new TextDecoder('utf-8');

	/**
	 * Reads and parses all .textile documents in the workspace.
	 * Files are processed in batches, to keep the number of open files small.
	 *
	 * @returns Array of processed .textile files.
	 */
	async getAllTextileDocuments(): Promise<SkinnyTextDocument[]> {
		const maxConcurrent = 20;

		const foundFiles = new Set<string>();

		const limiter = new Limiter<SkinnyTextDocument | undefined>(maxConcurrent);
		// Add files on disk
		const resources = await vscode.workspace.findFiles('**/*.textile', '**/node_modules/**');
		const onDiskResults = await Promise.all(resources.map(resource => {
			return limiter.queue(async () => {
				const doc = await this.getTextileDocument(resource);
				if (doc) {
					foundFiles.add(doc.uri.toString());
				}
				return doc;
			});
		}));
		// Add opened files (such as untitled files)
		const openTextDocumentResults = await Promise.all(vscode.workspace.textDocuments
			.filter(doc => !foundFiles.has(doc.uri.toString()) && this.isRelevantTextileDocument(doc)));

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
			const document = await this.getTextileDocument(resource);
			if (document) {
				this._onDidChangeTextileDocumentEmitter.fire(document);
			}
		}));

		this._register(this._watcher.onDidCreate(async resource => {
			const document = await this.getTextileDocument(resource);
			if (document) {
				this._onDidCreateTextileDocumentEmitter.fire(document);
			}
		}));

		this._register(this._watcher.onDidDelete(resource => {
			this._onDidDeleteTextileDocumentEmitter.fire(resource);
		}));

		this._register(vscode.workspace.onDidChangeTextDocument(e => {
			if (this.isRelevantTextileDocument(e.document)) {
				this._onDidChangeTextileDocumentEmitter.fire(e.document);
			}
		}));
	}

	private isRelevantTextileDocument(doc: vscode.TextDocument) {
		return isTextileFile(doc) && doc.uri.scheme !== 'vscode-bulkeditpreview';
	}

	public async getTextileDocument(resource: vscode.Uri): Promise<SkinnyTextDocument | undefined> {
		const matchingDocument = vscode.workspace.textDocuments.find((doc) => this.isRelevantTextileDocument(doc) && doc.uri.toString() === resource.toString());
		if (matchingDocument) {
			return matchingDocument;
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(resource);

			// We assume that textile is in UTF-8
			const text = this.utf8Decoder.decode(bytes);
			return new InMemoryDocument(resource, text, 0);
		} catch {
			return undefined;
		}
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
}
