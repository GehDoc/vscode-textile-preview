/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLinkProvider } from '../languageFeatures/documentLinkProvider';
import { TextileReference, TextileReferencesProvider } from '../languageFeatures/references';
import { githubSlugifier } from '../slugify';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { TextileWorkspaceContents } from '../workspaceContents';
import { createNewTextileEngine } from './engine';
import { InMemoryWorkspaceTextileDocuments } from './inMemoryWorkspace';
import { joinLines, workspacePath } from './util';


function getFileReferences(resource: vscode.Uri, workspaceContents: TextileWorkspaceContents) {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const provider = new TextileReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	return provider.getAllReferencesToFile(resource, noopToken);
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

	test('Should find basic references', async () => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceTextileDocuments([
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

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
		);
	});

	test('Should find references with and without file extensions', async () => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceTextileDocuments([
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

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	});

	test('Should find references with headers on links', async () => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');

		const refs = await getFileReferences(otherUri, new InMemoryWorkspaceTextileDocuments([
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

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
			{ uri: otherUri, line: 2 },
			{ uri: otherUri, line: 3 },
		);
	});
});
