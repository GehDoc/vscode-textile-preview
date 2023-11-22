/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileDocumentSymbolProvider } from '../languageFeatures/documentSymbols';
import { TextileWorkspaceSymbolProvider } from '../languageFeatures/workspaceSymbols';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { ITextDocument } from '../types/textDocument';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { withStore, workspacePath } from './util';

function getWorkspaceSymbols(store: DisposableStore, workspace: ITextileWorkspace, query = ''): Promise<vscode.SymbolInformation[]> {
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const symbolProvider = new TextileDocumentSymbolProvider(tocProvider, nulLogger);
	const workspaceSymbolProvider = store.add(new TextileWorkspaceSymbolProvider(symbolProvider, workspace));
	return workspaceSymbolProvider.provideWorkspaceSymbols(query);
}

suite('textile.WorkspaceSymbolProvider', () => {
	test('Should not return anything for empty workspace', withStore(async (store) => {
		const workspace = store.add(new InMemoryTextileWorkspace([]));
		assert.deepStrictEqual(await getWorkspaceSymbols(store, workspace, ''), []);
	}));

	// -- Begin : changed for textile
	test('Should return symbols from workspace with one textile file', withStore(async (store) => {
		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('test.textile'), `h1. header1\n\nabc\n\nh2. header2`)
		]));

		const symbols = await getWorkspaceSymbols(store, workspace, '');
		assert.strictEqual(symbols.length, 2);
		assert.strictEqual(symbols[0].name, 'h1. header1');
		assert.strictEqual(symbols[1].name, 'h2. header2');
	}));

	test('Should return all content  basic workspace', withStore(async (store) => {
		const fileNameCount = 10;
		const files: ITextDocument[] = [];
		for (let i = 0; i < fileNameCount; ++i) {
			const testFileName = workspacePath(`test${i}.textile`);
			files.push(new InMemoryDocument(testFileName, `h1. common\n\nabc\n\nh2. header${i}`));
		}

		const workspace = store.add(new InMemoryTextileWorkspace(files));

		const symbols = await getWorkspaceSymbols(store, workspace, '');
		assert.strictEqual(symbols.length, fileNameCount * 2);
	}));

	test('Should update results when textile file changes symbols', withStore(async (store) => {
		const testFileName = workspacePath('test.textile');
		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(testFileName, `h1. header1`, 1 /* version */)
		]));

		assert.strictEqual((await getWorkspaceSymbols(store, workspace, '')).length, 1);

		// Update file
		workspace.updateDocument(new InMemoryDocument(testFileName, `h1. new header\n\nabc\n\nh2. header2`, 2 /* version */));
		const newSymbols = await getWorkspaceSymbols(store, workspace, '');
		assert.strictEqual(newSymbols.length, 2);
		assert.strictEqual(newSymbols[0].name, 'h1. new header');
		assert.strictEqual(newSymbols[1].name, 'h2. header2');
	}));

	test('Should remove results when file is deleted', withStore(async (store) => {
		const testFileName = workspacePath('test.textile');

		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(testFileName, `h1. header1`)
		]));

		assert.strictEqual((await getWorkspaceSymbols(store, workspace, '')).length, 1);

		// delete file
		workspace.deleteDocument(testFileName);
		const newSymbols = await getWorkspaceSymbols(store, workspace, '');
		assert.strictEqual(newSymbols.length, 0);
	}));

	test('Should update results when textile file is created', withStore(async (store) => {
		const testFileName = workspacePath('test.textile');

		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(testFileName, `h1. header1`)
		]));

		assert.strictEqual((await getWorkspaceSymbols(store, workspace, '')).length, 1);

		// Create file
		workspace.createDocument(new InMemoryDocument(workspacePath('test2.textile'), `h1. new header\n\nabc\n\nh2. header2`));
		const newSymbols = await getWorkspaceSymbols(store, workspace, '');
		assert.strictEqual(newSymbols.length, 3);
	}));
	// -- End : changed for textile
});
