/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileDocumentSymbolProvider } from '../languageFeatures/documentSymbolProvider';
import { TextileWorkspaceSymbolProvider } from '../languageFeatures/workspaceSymbolProvider';
import { SkinnyTextDocument } from '../workspaceContents';
import { createNewTextileEngine } from './engine';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { InMemoryWorkspaceTextileDocuments } from './inMemoryWorkspace';


const symbolProvider = new TextileDocumentSymbolProvider(createNewTextileEngine());

suite('textile.WorkspaceSymbolProvider', () => {
	test('Should not return anything for empty workspace', async () => {
		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocuments([]));

		assert.deepStrictEqual(await provider.provideWorkspaceSymbols(''), []);
	});

	// -- Begin : changed for textile
	test('Should return symbols from workspace with one textile file', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocuments([
			new InMemoryDocument(testFileName, `h1. header1\n\nabc\n\nh2. header2`)
		]));

		const symbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(symbols.length, 2);
		assert.strictEqual(symbols[0].name, 'h1. header1');
		assert.strictEqual(symbols[1].name, 'h2. header2');
	});

	test('Should return all content  basic workspace', async () => {
		const fileNameCount = 10;
		const files: SkinnyTextDocument[] = [];
		for (let i = 0; i < fileNameCount; ++i) {
			const testFileName = vscode.Uri.file(`test${i}.textile`);
			files.push(new InMemoryDocument(testFileName, `h1. common\n\nabc\n\nh2. header${i}`));
		}

		const provider = new TextileWorkspaceSymbolProvider(symbolProvider, new InMemoryWorkspaceTextileDocuments(files));

		const symbols = await provider.provideWorkspaceSymbols('');
		assert.strictEqual(symbols.length, fileNameCount * 2);
	});

	test('Should update results when textile file changes symbols', async () => {
		const testFileName = vscode.Uri.file('test.textile');

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocuments([
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

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocuments([
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

		const workspaceFileProvider = new InMemoryWorkspaceTextileDocuments([
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
