/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileReference, TextileReferencesProvider } from '../languageFeatures/references';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { joinLines, withStore, workspacePath } from './util';


function getFileReferences(store: DisposableStore, resource: vscode.Uri, workspace: ITextileWorkspace) {
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const computer = store.add(new TextileReferencesProvider(engine, workspace, tocProvider, nulLogger));
	return computer.getReferencesToFileInWorkspace(resource, noopToken);
}

function assertReferencesEqual(actualRefs: readonly TextileReference[], ...expectedRefs: { uri: vscode.Uri; line: number }[]) {
	assert.strictEqual(actualRefs.length, expectedRefs.length, `Reference counts should match`);

	for (let i = 0; i < actualRefs.length; ++i) {
		const actual = actualRefs[i].location;
		const expected = expectedRefs[i];
		assert.strictEqual(actual.uri.toString(), expected.uri.toString(), `Ref '${i}' has expected document`);
		assert.strictEqual(actual.range.start.line, expected.line, `Ref '${i}' has expected start line`);
		assert.strictEqual(actual.range.end.line, expected.line, `Ref '${i}' has expected end line`);
	}
}

suite('textile: find file references', () => {

	test('Should find basic references', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(docUri, joinLines(
				`h1. header`,
				`"link 1":./other.textile`,
				`"link 2":./other.textile`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`h1. header`,
				`pre`,
				`"link 3":./other.textile`,
				`post`,
			)),
		]));

		const refs = await getFileReferences(store, otherUri, workspace);
		assertReferencesEqual(refs,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
		);
	}));

	test('Should find references with and without file extensions', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(docUri, joinLines(
				`h1. header`,
				`"link 1":./other.textile`,
				`"link 2":./other`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`h1. header`,
				`pre`,
				`"link 3":./other.textile`,
				`"link 4":./other`,
				`post`,
			)),
		]));

		const refs = await getFileReferences(store, otherUri, workspace);
		assertReferencesEqual(refs,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	}));

	test('Should find references with headers on links', withStore(async (store) => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const workspace = store.add(new InMemoryTextileWorkspace([
			new InMemoryDocument(docUri, joinLines(
				`h1. header`,
				`"link 1":./other.textile#sub-bla`,
				`"link 2":./other#sub-bla`,
			)),
			new InMemoryDocument(otherUri, joinLines(
				`h1. header`,
				`pre`,
				`"link 3":./other.textile#sub-bla`,
				`"link 4":./other#sub-bla`,
				`post`,
			)),
		]));

		const refs = await getFileReferences(store, otherUri, workspace);
		assertReferencesEqual(refs,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	}));
});
