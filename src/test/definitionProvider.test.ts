/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileVsCodeDefinitionProvider } from '../languageFeatures/definitions';
import { TextileReferencesProvider } from '../languageFeatures/references';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { joinLines, withStore, workspacePath } from './util';


function getDefinition(store: DisposableStore, doc: InMemoryDocument, pos: vscode.Position, workspace: ITextileWorkspace) {
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const referencesProvider = store.add(new TextileReferencesProvider(engine, workspace, tocProvider, nulLogger));
	const provider = new TextileVsCodeDefinitionProvider(referencesProvider);
	return provider.provideDefinition(doc, pos, noopToken);
}

function assertDefinitionsEqual(actualDef: vscode.Definition, ...expectedDefs: { uri: vscode.Uri; line: number; startCharacter?: number; endCharacter?: number }[]) {
	const actualDefsArr = Array.isArray(actualDef) ? actualDef : [actualDef];

	assert.strictEqual(actualDefsArr.length, expectedDefs.length, `Definition counts should match`);

	for (let i = 0; i < actualDefsArr.length; ++i) {
		const actual = actualDefsArr[i];
		const expected = expectedDefs[i];
		assert.strictEqual(actual.uri.toString(), expected.uri.toString(), `Definition '${i}' has expected document`);
		assert.strictEqual(actual.range.start.line, expected.line, `Definition '${i}' has expected start line`);
		assert.strictEqual(actual.range.end.line, expected.line, `Definition '${i}' has expected end line`);
		if (typeof expected.startCharacter !== 'undefined') {
			assert.strictEqual(actual.range.start.character, expected.startCharacter, `Definition '${i}' has expected start character`);
		}
		if (typeof expected.endCharacter !== 'undefined') {
			assert.strictEqual(actual.range.end.character, expected.endCharacter, `Definition '${i}' has expected end character`);
		}
	}
}

suite('textile: Go to definition', () => {
	test('Should not return definition when on link text', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`"ref":#abc`,
			`[ref]http://example.com`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const defs = await getDefinition(store, doc, new vscode.Position(0, 1), workspace);
		assert.deepStrictEqual(defs, undefined);
	}));

	test('Should find definition links within file from link', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(docUri, joinLines(
			`"link 1":abc`, // trigger here
			``,
			`[abc]https://example.com`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const defs = await getDefinition(store, doc, new vscode.Position(0, 12), workspace);
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	}));

	test('Should find definition links using shorthand', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(docUri, joinLines(
			'', // Disabled : not relevant for Textile : `[ref]`, // trigger 1'
			``,
			`"yes":ref`, // trigger 2
			``,
			`[ref]/Hello.textile` // trigger 3
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		/* Disabled : not relevant for Textile
		{
			const defs = await getDefinition(store, doc, new vscode.Position(0, 2), workspace);
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
		*/
		{
			const defs = await getDefinition(store, doc, new vscode.Position(2, 7), workspace);
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
		{
			const defs = await getDefinition(store, doc, new vscode.Position(4, 2), workspace);
			assertDefinitionsEqual(defs!,
				{ uri: docUri, line: 4 },
			);
		}
	}));

	test('Should find definition links within file from definition', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(docUri, joinLines(
			`"link 1":abc`,
			``,
			`[abc]https://example.com`, // trigger here
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const defs = await getDefinition(store, doc, new vscode.Position(2, 3), workspace);
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	}));

	test('Should not find definition links across files', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(docUri, joinLines(
			`"link 1":abc`,
			``,
			`[abc]https://example.com`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([
			doc,
			new InMemoryDocument(workspacePath('other.textile'), joinLines(
				`"link 1":abc`,
				``,
				`[abc]https://example.com?bad`,
			))
		]));

		const defs = await getDefinition(store, doc, new vscode.Position(0, 12), workspace);
		assertDefinitionsEqual(defs!,
			{ uri: docUri, line: 2 },
		);
	}));
});
