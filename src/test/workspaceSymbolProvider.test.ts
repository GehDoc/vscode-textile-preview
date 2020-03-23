/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import TextileDocumentSymbolProvider from '../features/documentSymbolProvider';
import TextileWorkspaceSymbolProvider, { WorkspaceTextileDocumentProvider } from '../features/workspaceSymbolProvider';
import { createNewTextileEngine } from './engine';
import { InMemoryDocument } from './inMemoryDocument';


const symbolProvider = new TextileDocumentSymbolProvider(createNewTextileEngine());

suite('textile.WorkspaceSymbolProvider', () => {
	test('Should not return anything for empty workspace', async () => {
		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocumentProvider([]));

		assert.deepEqual(await provider.provideWorkspaceSymbols(''), []);
	});

	// -- Begin : changed for textile
	test('Should return symbols from workspace with one textile file', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocumentProvider([
			new InMemoryDocument(testFileName, `h1. header1\n\nabc\n\nh2. header2`)
		]));

		const symbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(symbols.length, 2);
		assert.strictEqual(symbols[0].name, 'h1. header1');
		assert.strictEqual(symbols[1].name, 'h2. header2');
	});

	test('Should return all content  basic workspace', async () => {
		const fileNameCount = 10;
		const files: vscode.TextDocument[] = [];
		for (let i = 0; i < fileNameCount; ++i) {
			const testFileName = vscode.Uri.file(`test${i}.textile`);
			files.push(new InMemoryDocument(testFileName, `h1. common\n\nabc\n\nh2. header${i}`));
		}

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocumentProvider(files));

		const symbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(symbols.length, fileNameCount * 2);
	});

	test('Should update results when textile file changes symbols', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocumentProvider([
			new InMemoryDocument(testFileName, `h1. header1`, 1 /* version */)
		]);

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, workspaceFileProvider);

		assert.strictEqual((await provider.provideWorkspaceSymbols('')).length, 1);

		// Update file
		workspaceFileProvider.updateDocument(new InMemoryDocument(testFileName, `h1. new header\n\nabc\n\nh2. header2`, 2 /* version */));
		const newSymbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(newSymbols.length, 2);
		assert.strictEqual(newSymbols[0].name, 'h1. new header');
		assert.strictEqual(newSymbols[1].name, 'h2. header2');
	});

	test('Should remove results when file is deleted', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocumentProvider([
			new InMemoryDocument(testFileName, `h1. header1`)
		]);

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, workspaceFileProvider);
		assert.strictEqual((await provider.provideWorkspaceSymbols('')).length, 1);

		// delete file
		workspaceFileProvider.deleteDocument(testFileName);
		const newSymbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(newSymbols.length, 0);
	});

	test('Should update results when textile file is created', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocumentProvider([
			new InMemoryDocument(testFileName, `h1. header1`)
		]);

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, workspaceFileProvider);
		assert.strictEqual((await provider.provideWorkspaceSymbols('')).length, 1);

		// Creat file
		workspaceFileProvider.createDocument(new InMemoryDocument(vscode.Uri.file('test2.textile'), `h1. new header\n\nabc\n\nh2. header2`));
		const newSymbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(newSymbols.length, 3);
	});
	// -- End : changed for textile
});


class InMemoryWorkspaceTextileDocumentProvider implements WorkspaceTextileDocumentProvider {
	private readonly _documents = new Map<string, vscode.TextDocument>();

	constructor(documents: vscode.TextDocument[]) {
		for (const doc of documents) {
			this._documents.set(doc.fileName, doc);
		}
	}

	async getAllTextileDocuments() {
		return Array.from(this._documents.values());
	}

	private readonly _onDidChangeTextileDocumentEmitter = new vscode.EventEmitter<vscode.TextDocument>();
	public onDidChangeTextileDocument = this._onDidChangeTextileDocumentEmitter.event;

	private readonly _onDidCreateTextileDocumentEmitter = new vscode.EventEmitter<vscode.TextDocument>();
	public onDidCreateTextileDocument = this._onDidCreateTextileDocumentEmitter.event;

	private readonly _onDidDeleteTextileDocumentEmitter = new vscode.EventEmitter<vscode.Uri>();
	public onDidDeleteTextileDocument = this._onDidDeleteTextileDocumentEmitter.event;

	public updateDocument(document: vscode.TextDocument) {
		this._documents.set(document.fileName, document);
		this._onDidChangeTextileDocumentEmitter.fire(document);
	}

	public createDocument(document: vscode.TextDocument) {
		assert.ok(!this._documents.has(document.uri.fsPath));

		this._documents.set(document.uri.fsPath, document);
		this._onDidCreateTextileDocumentEmitter.fire(document);
	}

	public deleteDocument(resource: vscode.Uri) {
		this._documents.delete(resource.fsPath);
		this._onDidDeleteTextileDocumentEmitter.fire(resource);
	}
}
