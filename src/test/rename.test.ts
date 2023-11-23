/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileReferencesProvider } from '../languageFeatures/references';
import { TextileVsCodeRenameProvider, TextileWorkspaceEdit } from '../languageFeatures/rename';
import { githubSlugifier } from '../slugify';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { assertRangeEqual, joinLines, withStore, workspacePath } from './util';


/**
 * Get prepare rename info.
 */
function prepareRename(store: DisposableStore, doc: InMemoryDocument, pos: vscode.Position, workspace: ITextileWorkspace): Promise<undefined | { readonly range: vscode.Range; readonly placeholder: string }> {
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const referenceComputer = store.add(new TextileReferencesProvider(engine, workspace, tocProvider, nulLogger));
	const renameProvider = store.add(new TextileVsCodeRenameProvider(workspace, referenceComputer, githubSlugifier));
	return renameProvider.prepareRename(doc, pos, noopToken);
}

/**
 * Get all the edits for the rename.
 */
function getRenameEdits(store: DisposableStore, doc: InMemoryDocument, pos: vscode.Position, newName: string, workspace: ITextileWorkspace): Promise<TextileWorkspaceEdit | undefined> {
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const referencesProvider = store.add(new TextileReferencesProvider(engine, workspace, tocProvider, nulLogger));
	const renameProvider = store.add(new TextileVsCodeRenameProvider(workspace, referencesProvider, githubSlugifier));
	return renameProvider.provideRenameEditsImpl(doc, pos, newName, noopToken);
}

interface ExpectedTextEdit {
	readonly uri: vscode.Uri;
	readonly edits: readonly vscode.TextEdit[];
}

interface ExpectedFileRename {
	readonly originalUri: vscode.Uri;
	readonly newUri: vscode.Uri;
}

function assertEditsEqual(actualEdit: TextileWorkspaceEdit, ...expectedEdits: ReadonlyArray<ExpectedTextEdit | ExpectedFileRename>) {
	// Check file renames
	const expectedFileRenames = expectedEdits.filter(expected => 'originalUri' in expected) as ExpectedFileRename[];
	const actualFileRenames = actualEdit.fileRenames ?? [];
	assert.strictEqual(actualFileRenames.length, expectedFileRenames.length, `File rename count should match`);
	for (let i = 0; i < actualFileRenames.length; ++i) {
		const expected = expectedFileRenames[i];
		const actual = actualFileRenames[i];
		assert.strictEqual(actual.from.toString(), expected.originalUri.toString(), `File rename '${i}' should have expected 'from' resource`);
		assert.strictEqual(actual.to.toString(), expected.newUri.toString(), `File rename '${i}' should have expected 'to' resource`);
	}

	// Check text edits
	const actualTextEdits = actualEdit.edit.entries();
	const expectedTextEdits = expectedEdits.filter(expected => 'edits' in expected) as ExpectedTextEdit[];
	assert.strictEqual(actualTextEdits.length, expectedTextEdits.length, `Reference counts should match`);
	for (let i = 0; i < actualTextEdits.length; ++i) {
		const expected = expectedTextEdits[i];
		const actual = actualTextEdits[i];

		if ('edits' in expected) {
			assert.strictEqual(actual[0].toString(), expected.uri.toString(), `Ref '${i}' has expected document`);

			const actualEditForDoc = actual[1];
			const expectedEditsForDoc = expected.edits;
			assert.strictEqual(actualEditForDoc.length, expectedEditsForDoc.length, `Edit counts for '${actual[0]}' should match`);

			for (let g = 0; g < actualEditForDoc.length; ++g) {
				assertRangeEqual(actualEditForDoc[g].range, expectedEditsForDoc[g].range, `Edit '${g}' of '${actual[0]}' has expected expected range. Expected range: ${JSON.stringify(actualEditForDoc[g].range)}. Actual range: ${JSON.stringify(expectedEditsForDoc[g].range)}`);
				assert.strictEqual(actualEditForDoc[g].newText, expectedEditsForDoc[g].newText, `Edit '${g}' of '${actual[0]}' has expected edits`);
			}
		}
	}
}

suite('textile: rename', () => {

	setup(async () => {
		// the tests make the assumption that link providers are already registered
		await vscode.extensions.getExtension('gehdoc.vscode-textile-preview')!.activate();
	});

	test('Rename on header should not include leading #', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. abc`
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const info = await prepareRename(store, doc, new vscode.Position(0, 0), workspace);
		assertRangeEqual(info!.range, new vscode.Range(0, 4, 0, 7));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 0), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 7), 'New Header')
			]
		});
	}));

	/* Not relevant for Textile
	test('Rename on header should include leading or trailing #s', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`### abc ###`
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const info = await prepareRename(store, doc, new vscode.Position(0, 0), workspace);
		assertRangeEqual(info!.range, new vscode.Range(0, 4, 0, 7));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 0), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 7), 'New Header')
			]
		});
	}));
	*/

	test('Rename on header should pick up links in doc', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`, // rename here
			``, // Added for Textile
			`"text":#a-b-c`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 0), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		});
	}));

	test('Rename on link should use slug for link', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`, // rename here
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const edit = await getRenameEdits(store, doc, new vscode.Position(2, 10), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		});
	}));

	test('Rename on link definition should work', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`,
			`[ref]#a-b-c`// rename here
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const edit = await getRenameEdits(store, doc, new vscode.Position(3, 10), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
				new vscode.TextEdit(new vscode.Range(3, 6, 3, 11), 'new-header'),
			]
		});
	}));

	test('Rename on header should pick up links across files', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`, // rename here
			``, // Added for Textile
			`"text":#a-b-c`,
		));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 0), "New Header", new InMemoryTextileWorkspace([
			doc,
			new InMemoryDocument(otherUri, joinLines(
				`"text":#a-b-c`, // Should not find this
				`"text":./doc.textile#a-b-c`, // But should find this
				`"text":./doc#a-b-c`, // And this
			))
		]));
		assertEditsEqual(edit!, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		}, {
			uri: otherUri, edits: [
				new vscode.TextEdit(new vscode.Range(1, 21, 1, 26), 'new-header'),
				new vscode.TextEdit(new vscode.Range(2, 13, 2, 18), 'new-header'),
			]
		});
	}));

	test('Rename on link should pick up links across files', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`,  // rename here
		));

		const edit = await getRenameEdits(store, doc, new vscode.Position(2, 10), "New Header", new InMemoryTextileWorkspace([
			doc,
			new InMemoryDocument(otherUri, joinLines(
				`"text":#a-b-c`, // Should not find this
				`"text":./doc.textile#a-b-c`, // But should find this
				`"text":./doc#a-b-c`, // And this
			))
		]));
		assertEditsEqual(edit!, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		}, {
			uri: otherUri, edits: [
				new vscode.TextEdit(new vscode.Range(1, 21, 1, 26), 'new-header'),
				new vscode.TextEdit(new vscode.Range(2, 13, 2, 18), 'new-header'),
			]
		});
	}));

	test('Rename on link in other file should pick up all refs', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`,
		));

		const otherDoc = new InMemoryDocument(otherUri, joinLines(
			`"text":#a-b-c`,
			`"text":./doc.textile#a-b-c`,
			`"text":./doc#a-b-c`
		));

		const expectedEdits = [
			{
				uri: uri, edits: [
					new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
					new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
				]
			}, {
				uri: otherUri, edits: [
					new vscode.TextEdit(new vscode.Range(1, 21, 1, 26), 'new-header'),
					new vscode.TextEdit(new vscode.Range(2, 13, 2, 18), 'new-header'),
				]
			}
		];

		{
			// Rename on header with file extension
			const edit = await getRenameEdits(store, otherDoc, new vscode.Position(1, 22), "New Header", new InMemoryTextileWorkspace([
				doc,
				otherDoc
			]));
			assertEditsEqual(edit!, ...expectedEdits);
		}
		{
			// Rename on header without extension
			const edit = await getRenameEdits(store, otherDoc, new vscode.Position(2, 15), "New Header", new InMemoryTextileWorkspace([
				doc,
				otherDoc
			]));
			assertEditsEqual(edit!, ...expectedEdits);
		}
	}));

	test('Rename on reference should rename references and definition', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":ref`, // rename here
			`"other":ref`,
			``,
			`[ref]https://example.com`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 8), "new ref", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 10), 'new ref'),
				new vscode.TextEdit(new vscode.Range(1, 8, 1, 11), 'new ref'),
				new vscode.TextEdit(new vscode.Range(3, 1, 3, 4), 'new ref'),
			]
		});
	}));

	test('Rename on definition should rename references and definitions', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":ref`,
			`"other":ref`,
			``,
			`[ref]https://example.com`, // rename here
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const edit = await getRenameEdits(store, doc, new vscode.Position(3, 3), "new ref", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 10), 'new ref'),
				new vscode.TextEdit(new vscode.Range(1, 8, 1, 11), 'new ref'),
				new vscode.TextEdit(new vscode.Range(3, 1, 3, 4), 'new ref'),
			]
		});
	}));

	test('Rename on definition entry should rename header and references', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. a B c`,
			``, // Added for Textile
			`"ref text":ref`,
			`"direct":#a-b-c`,
			`[ref]#a-b-c`, // rename here
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const preparedInfo = await prepareRename(store, doc, new vscode.Position(4, 10), workspace);
		assert.strictEqual(preparedInfo!.placeholder, 'a B c');
		assertRangeEqual(preparedInfo!.range, new vscode.Range(4, 6, 4, 11));

		const edit = await getRenameEdits(store, doc, new vscode.Position(4, 10), "x Y z", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'x Y z'),
				new vscode.TextEdit(new vscode.Range(3, 10, 3, 15), 'x-y-z'),
				new vscode.TextEdit(new vscode.Range(4, 6, 4, 11), 'x-y-z'),
			]
		});
	}));

	test('Rename should not be supported on link text', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. Header`,
			``, // Added for Textile
			`"text":#header`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		await assert.rejects(prepareRename(store, doc, new vscode.Position(2, 2), workspace));
	}));

	test('Path rename should use file path as range', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile`,
			`[ref]./doc.textile`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const info = await prepareRename(store, doc, new vscode.Position(0, 10), workspace);
		assert.strictEqual(info!.placeholder, './doc.textile');
		assertRangeEqual(info!.range, new vscode.Range(0, 7, 0, 20));
	}));

	test('Path rename\'s range should excludes fragment', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile#some-header`,
			`[ref]./doc.textile#some-header`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const info = await prepareRename(store, doc, new vscode.Position(0, 10), workspace);
		assert.strictEqual(info!.placeholder, './doc.textile');
		assertRangeEqual(info!.range, new vscode.Range(0, 7, 0, 20));
	}));

	test('Path rename should update file and all refs', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile`,
			`[ref]./doc.textile`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 10), './sub/newDoc.textile', workspace);
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('sub', 'newDoc.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 20), './sub/newDoc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 18), './sub/newDoc.textile'),
			]
		});
	}));

	test('Path rename using absolute file path should anchor to workspace root', withStore(async (store) => {
		const uri = workspacePath('sub', 'doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc.textile`,
			`[ref]/sub/doc.textile`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 10), '/newSub/newDoc.textile', workspace);
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('newSub', 'newDoc.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 23), '/newSub/newDoc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 21), '/newSub/newDoc.textile'),
			]
		});
	}));

	test('Path rename should use un-encoded paths as placeholder', withStore(async (store) => {
		const uri = workspacePath('sub', 'doc with spaces.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc%20with%20spaces.textile`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const info = await prepareRename(store, doc, new vscode.Position(0, 10), workspace);
		assert.strictEqual(info!.placeholder, '/sub/doc with spaces.textile');
	}));

	test('Path rename should encode paths', withStore(async (store) => {
		const uri = workspacePath('sub', 'doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc.textile`,
			`[ref]/sub/doc.textile`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 10), '/NEW sub/new DOC.textile', workspace);
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('NEW sub', 'new DOC.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 23), '/NEW%20sub/new%20DOC.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 21), '/NEW%20sub/new%20DOC.textile'),
			]
		});
	}));

	test('Path rename should work with unknown files', withStore(async (store) => {
		const uri1 = workspacePath('doc1.textile');
		const doc1 = new InMemoryDocument(uri1, joinLines(
			`!/images/more/image.png(img)!`,
			``,
			`[ref]/images/more/image.png`,
		));

		const uri2 = workspacePath('sub', 'doc2.textile');
		const doc2 = new InMemoryDocument(uri2, joinLines(
			`!/images/more/image.png(img)!`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([
			doc1,
			doc2
		]));

		const edit = await getRenameEdits(store, doc1, new vscode.Position(0, 10), '/img/test/new.png', workspace);
		assertEditsEqual(edit!,
			// Should not have file edits since the files don't exist here
			{
				uri: uri1, edits: [
					new vscode.TextEdit(new vscode.Range(0, 1, 0, 23), '/img/test/new.png'),
					new vscode.TextEdit(new vscode.Range(2, 5, 2, 27), '/img/test/new.png'),
				]
			},
			{
				uri: uri2, edits: [
					new vscode.TextEdit(new vscode.Range(0, 1, 0, 23), '/img/test/new.png'),
				]
			});
	}));

	test('Path rename should use .textile extension on extension-less link', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/doc#header`,
			`[ref]/doc#other`,
		));
		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const edit = await getRenameEdits(store, doc, new vscode.Position(0, 10), '/new File', workspace);
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('new File.textile'), // Rename on disk should use file extension
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 11), '/new%20File'), // Links should continue to use extension-less paths
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 9), '/new%20File'),
			]
		});
	}));

	// TODO: fails on windows
	test.skip('Path rename should use correctly resolved paths across files', withStore(async (store) => {
		const uri1 = workspacePath('sub', 'doc.textile');
		const doc1 = new InMemoryDocument(uri1, joinLines(
			`"text":./doc.textile`,
			`[ref]./doc.textile`,
		));

		const uri2 = workspacePath('doc2.textile');
		const doc2 = new InMemoryDocument(uri2, joinLines(
			`"text":./sub/doc.textile`,
			`[ref]./sub/doc.textile`,
		));

		const uri3 = workspacePath('sub2', 'doc3.textile');
		const doc3 = new InMemoryDocument(uri3, joinLines(
			`"text":../sub/doc.textile`,
			`[ref]../sub/doc.textile`,
		));

		const uri4 = workspacePath('sub2', 'doc4.textile');
		const doc4 = new InMemoryDocument(uri4, joinLines(
			`"text":/sub/doc.textile`,
			`[ref]/sub/doc.textile`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([
			doc1, doc2, doc3, doc4,
		]));

		const edit = await getRenameEdits(store, doc1, new vscode.Position(0, 10), './new/new-doc.textile', workspace);
		assertEditsEqual(edit!, {
			originalUri: uri1,
			newUri: workspacePath('sub', 'new', 'new-doc.textile'),
		}, {
			uri: uri1, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 15), './new/new-doc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 7, 1, 15), './new/new-doc.textile'),
			]
		}, {
			uri: uri2, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 19), './sub/new/new-doc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 7, 1, 19), './sub/new/new-doc.textile'),
			]
		}, {
			uri: uri3, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 20), '../sub/new/new-doc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 7, 1, 20), '../sub/new/new-doc.textile'),
			]
		}, {
			uri: uri4, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 18), '/sub/new/new-doc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 7, 1, 18), '/sub/new/new-doc.textile'),
			]
		});
	}));

	test('Path rename should resolve on links without prefix', withStore(async (store) => {
		const uri1 = workspacePath('sub', 'doc.textile');
		const doc1 = new InMemoryDocument(uri1, joinLines(
			`!sub2/doc3.textile(text)!`,
		));

		const uri2 = workspacePath('doc2.textile');
		const doc2 = new InMemoryDocument(uri2, joinLines(
			`!sub/sub2/doc3.textile(text)!`,
		));

		const uri3 = workspacePath('sub', 'sub2', 'doc3.textile');
		const doc3 = new InMemoryDocument(uri3, joinLines());

		const workspace = store.add(new InMemoryTextileWorkspace([
			doc1, doc2, doc3
		]));

		const edit = await getRenameEdits(store, doc1, new vscode.Position(0, 10), 'sub2/cat.textile', workspace);
		assertEditsEqual(edit!, {
			originalUri: workspacePath('sub', 'sub2', 'doc3.textile'),
			newUri: workspacePath('sub', 'sub2', 'cat.textile'),
		}, {
			uri: uri1, edits: [new vscode.TextEdit(new vscode.Range(0, 1, 0, 18), 'sub2/cat.textile')]
		}, {
			uri: uri2, edits: [new vscode.TextEdit(new vscode.Range(0, 1, 0, 22), 'sub/sub2/cat.textile')]
		});
	}));

	test('Rename on link should use header text as placeholder', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. a B c`,
			``,
			`[text]#a-b-c`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));
		const info = await prepareRename(store, doc, new vscode.Position(2, 10), workspace);
		assert.strictEqual(info!.placeholder, 'a B c');
		assertRangeEqual(info!.range, new vscode.Range(2, 7, 2, 12));
	}));

	test('Rename on http uri should work', withStore(async (store) => {
		const uri1 = workspacePath('doc.textile');
		const uri2 = workspacePath('doc2.textile');
		const doc = new InMemoryDocument(uri1, joinLines(
			`"1":http://example.com`,
			`[2]http://example.com`,
			// not relevant for textile : `<http://example.com>`,
		));

		const workspace = store.add(new InMemoryTextileWorkspace([
			doc,
			new InMemoryDocument(uri2, joinLines(
				`"4":http://example.com`,
			))
		]));

		const edit = await getRenameEdits(store, doc, new vscode.Position(1, 10), "https://example.com/sub", workspace);
		assertEditsEqual(edit!, {
			uri: uri1, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 22), 'https://example.com/sub'),
				new vscode.TextEdit(new vscode.Range(1, 3, 1, 21), 'https://example.com/sub'),
				// not relevant for textile : new vscode.TextEdit(new vscode.Range(2, 1, 2, 19), 'https://example.com/sub'),
			]
		}, {
			uri: uri2, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 22), 'https://example.com/sub'),
			]
		});
	}));

	test('Rename on definition path should update all references to path', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"ref text":ref`,
			`"direct":/file`,
			`[ref]/file`, // rename here
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const preparedInfo = await prepareRename(store, doc, new vscode.Position(2, 10), workspace);
		assert.strictEqual(preparedInfo!.placeholder, '/file');
		assertRangeEqual(preparedInfo!.range, new vscode.Range(2, 5, 2, 10));

		const edit = await getRenameEdits(store, doc, new vscode.Position(2, 10), "/newFile", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(1, 9, 1, 14), '/newFile'),
				new vscode.TextEdit(new vscode.Range(2, 5, 2, 10), '/newFile'),
			]
		});
	}));

	test('Rename on definition path where file exists should also update file', withStore(async (store) => {
		const uri1 = workspacePath('doc.textile');
		const doc1 = new InMemoryDocument(uri1, joinLines(
			`"ref text":ref`,
			`"direct":/doc2`,
			`[ref]/doc2`, // rename here
		));

		const uri2 = workspacePath('doc2.textile');
		const doc2 = new InMemoryDocument(uri2, joinLines());

		const workspace = store.add(new InMemoryTextileWorkspace([doc1, doc2]));

		const preparedInfo = await prepareRename(store, doc1, new vscode.Position(2, 10), workspace);
		assert.strictEqual(preparedInfo!.placeholder, '/doc2');
		assertRangeEqual(preparedInfo!.range, new vscode.Range(2, 5, 2, 10));

		const edit = await getRenameEdits(store, doc1, new vscode.Position(2, 10), "/new-doc", workspace);
		assertEditsEqual(edit!, {
			uri: uri1, edits: [
				new vscode.TextEdit(new vscode.Range(1, 9, 1, 14), '/new-doc'),
				new vscode.TextEdit(new vscode.Range(2, 5, 2, 10), '/new-doc'),
			]
		}, {
			originalUri: uri2,
			newUri: workspacePath('new-doc.textile')
		});
	}));

	test('Rename on definition path header should update all references to header', withStore(async (store) => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"ref text":ref`,
			`"direct":/file#header`,
			`[ref]/file#header`, // rename here
		));

		const workspace = store.add(new InMemoryTextileWorkspace([doc]));

		const preparedInfo = await prepareRename(store, doc, new vscode.Position(2, 16), workspace);
		assert.strictEqual(preparedInfo!.placeholder, 'header');
		assertRangeEqual(preparedInfo!.range, new vscode.Range(2, 11, 2, 17));

		const edit = await getRenameEdits(store, doc, new vscode.Position(2, 16), "New Header", workspace);
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(1, 15, 1, 21), 'new-header'),
				new vscode.TextEdit(new vscode.Range(2, 11, 2, 17), 'new-header'),
			]
		});
	}));
});
