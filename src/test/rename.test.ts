/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLinkProvider } from '../languageFeatures/documentLinkProvider';
import { TextileReferencesProvider } from '../languageFeatures/references';
import { TextileRenameProvider, TextileWorkspaceEdit } from '../languageFeatures/rename';
import { githubSlugifier } from '../slugify';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { TextileWorkspaceContents } from '../workspaceContents';
import { createNewTextileEngine } from './engine';
import { InMemoryWorkspaceTextileDocuments } from './inMemoryWorkspace';
import { assertRangeEqual, joinLines, noopToken, workspacePath } from './util';


/**
 * Get prepare rename info.
 */
function prepareRename(doc: InMemoryDocument, pos: vscode.Position, workspaceContents: TextileWorkspaceContents): Promise<undefined | { readonly range: vscode.Range; readonly placeholder: string }> {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const referencesProvider = new TextileReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	const renameProvider = new TextileRenameProvider(referencesProvider, workspaceContents, githubSlugifier);
	return renameProvider.prepareRename(doc, pos, noopToken);
}

/**
 * Get all the edits for the rename.
 */
function getRenameEdits(doc: InMemoryDocument, pos: vscode.Position, newName: string, workspaceContents: TextileWorkspaceContents): Promise<TextileWorkspaceEdit | undefined> {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const referencesProvider = new TextileReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	const renameProvider = new TextileRenameProvider(referencesProvider, workspaceContents, githubSlugifier);
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

	test('Rename on header should not include leading #', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. abc`
		));

		const info = await prepareRename(doc, new vscode.Position(0, 0), new InMemoryWorkspaceTextileDocuments([doc]));
		assertRangeEqual(info!.range, new vscode.Range(0, 4, 0, 7));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 0), "New Header", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 7), 'New Header')
			]
		});
	});

	/* Not relevant for Textile
	test('Rename on header should include leading or trailing #s', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`### abc ###`
		));

		const info = await prepareRename(doc, new vscode.Position(0, 0), new InMemoryWorkspaceTextileDocuments([doc]));
		assertRangeEqual(info!.range, new vscode.Range(0, 4, 0, 7));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 0), "New Header", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 7), 'New Header')
			]
		});
	});
	*/

	test('Rename on header should pick up links in doc', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`, // rename here
			``, // Added for Textile
			`"text":#a-b-c`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 0), "New Header", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		});
	});

	test('Rename on link should use slug for link', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`, // rename here
		));

		const edit = await getRenameEdits(doc, new vscode.Position(2, 10), "New Header", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
			]
		});
	});

	test('Rename on link definition should work', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`,
			`[ref]#a-b-c`// rename here
		));

		const edit = await getRenameEdits(doc, new vscode.Position(3, 10), "New Header", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'New Header'),
				new vscode.TextEdit(new vscode.Range(2, 8, 2, 13), 'new-header'),
				new vscode.TextEdit(new vscode.Range(3, 6, 3, 11), 'new-header'),
			]
		});
	});

	test('Rename on header should pick up links across files', async () => {
		const uri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`, // rename here
			``, // Added for Textile
			`"text":#a-b-c`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 0), "New Header", new InMemoryWorkspaceTextileDocuments([
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
	});

	test('Rename on link should pick up links across files', async () => {
		const uri = workspacePath('doc.textile');
		const otherUri = workspacePath('other.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. A b C`,
			``, // Added for Textile
			`"text":#a-b-c`,  // rename here
		));

		const edit = await getRenameEdits(doc, new vscode.Position(2, 10), "New Header", new InMemoryWorkspaceTextileDocuments([
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
	});

	test('Rename on link in other file should pick up all refs', async () => {
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
			const edit = await getRenameEdits(otherDoc, new vscode.Position(1, 22), "New Header", new InMemoryWorkspaceTextileDocuments([
				doc,
				otherDoc
			]));
			assertEditsEqual(edit!, ...expectedEdits);
		}
		{
			// Rename on header without extension
			const edit = await getRenameEdits(otherDoc, new vscode.Position(2, 15), "New Header", new InMemoryWorkspaceTextileDocuments([
				doc,
				otherDoc
			]));
			assertEditsEqual(edit!, ...expectedEdits);
		}
	});

	test('Rename on reference should rename references and definition', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":ref`, // rename here
			`"other":ref`,
			``,
			`[ref]https://example.com`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 8), "new ref", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 10), 'new ref'),
				new vscode.TextEdit(new vscode.Range(1, 8, 1, 11), 'new ref'),
				new vscode.TextEdit(new vscode.Range(3, 1, 3, 4), 'new ref'),
			]
		});
	});

	test('Rename on definition should rename references and definitions', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":ref`,
			`"other":ref`,
			``,
			`[ref]https://example.com`, // rename here
		));

		const edit = await getRenameEdits(doc, new vscode.Position(3, 3), "new ref", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 10), 'new ref'),
				new vscode.TextEdit(new vscode.Range(1, 8, 1, 11), 'new ref'),
				new vscode.TextEdit(new vscode.Range(3, 1, 3, 4), 'new ref'),
			]
		});
	});

	test('Rename on definition entry should rename header and references', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. a B c`,
			``, // Added for Textile
			`"ref text":ref`,
			`"direct":#a-b-c`,
			`[ref]#a-b-c`, // rename here
		));

		const preparedInfo = await prepareRename(doc, new vscode.Position(4, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.strictEqual(preparedInfo!.placeholder, 'a B c');
		assertRangeEqual(preparedInfo!.range, new vscode.Range(4, 6, 4, 11));

		const edit = await getRenameEdits(doc, new vscode.Position(4, 10), "x Y z", new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 4, 0, 9), 'x Y z'),
				new vscode.TextEdit(new vscode.Range(3, 10, 3, 15), 'x-y-z'),
				new vscode.TextEdit(new vscode.Range(4, 6, 4, 11), 'x-y-z'),
			]
		});
	});

	test('Rename should not be supported on link text', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. Header`,
			``, // Added for Textile
			`"text":#header`,
		));

		await assert.rejects(prepareRename(doc, new vscode.Position(2, 2), new InMemoryWorkspaceTextileDocuments([doc])));
	});

	test('Path rename should use file path as range', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile`,
			`[ref]./doc.textile`,
		));

		const info = await prepareRename(doc, new vscode.Position(0, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.strictEqual(info!.placeholder, './doc.textile');
		assertRangeEqual(info!.range, new vscode.Range(0, 7, 0, 20));
	});

	test('Path rename\'s range should excludes fragment', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile#some-header`,
			`[ref]./doc.textile#some-header`,
		));

		const info = await prepareRename(doc, new vscode.Position(0, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.strictEqual(info!.placeholder, './doc.textile');
		assertRangeEqual(info!.range, new vscode.Range(0, 7, 0, 20));
	});

	test('Path rename should update file and all refs', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":./doc.textile`,
			`[ref]./doc.textile`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 10), './sub/newDoc.textile', new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('sub', 'newDoc.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 20), './sub/newDoc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 18), './sub/newDoc.textile'),
			]
		});
	});

	test('Path rename using absolute file path should anchor to workspace root', async () => {
		const uri = workspacePath('sub', 'doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc.textile`,
			`[ref]/sub/doc.textile`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 10), '/newSub/newDoc.textile', new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('newSub', 'newDoc.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 23), '/newSub/newDoc.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 21), '/newSub/newDoc.textile'),
			]
		});
	});

	test('Path rename should use un-encoded paths as placeholder', async () => {
		const uri = workspacePath('sub', 'doc with spaces.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc%20with%20spaces.textile`,
		));

		const info = await prepareRename(doc, new vscode.Position(0, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.strictEqual(info!.placeholder, '/sub/doc with spaces.textile');
	});

	test('Path rename should encode paths', async () => {
		const uri = workspacePath('sub', 'doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/sub/doc.textile`,
			`[ref]/sub/doc.textile`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 10), '/NEW sub/new DOC.textile', new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('NEW sub', 'new DOC.textile'),
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 23), '/NEW%20sub/new%20DOC.textile'),
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 21), '/NEW%20sub/new%20DOC.textile'),
			]
		});
	});

	test('Path rename should work with unknown files', async () => {
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

		const edit = await getRenameEdits(doc1, new vscode.Position(0, 10), '/img/test/new.png', new InMemoryWorkspaceTextileDocuments([
			doc1,
			doc2
		]));
		assertEditsEqual(edit!, {
			originalUri: workspacePath('images', 'more', 'image.png'),
			newUri: workspacePath('img', 'test', 'new.png'),
		}, {
			uri: uri1, edits: [
				new vscode.TextEdit(new vscode.Range(0, 1, 0, 23), '/img/test/new.png'),
				new vscode.TextEdit(new vscode.Range(2, 5, 2, 27), '/img/test/new.png'),
			]
		}, {
			uri: uri2, edits: [
				new vscode.TextEdit(new vscode.Range(0, 1, 0, 23), '/img/test/new.png'),
			]
		});
	});

	test('Path rename should use .textile extension on extension-less link', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"text":/doc#header`,
			`[ref]/doc#other`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(0, 10), '/new File', new InMemoryWorkspaceTextileDocuments([doc]));
		assertEditsEqual(edit!, {
			originalUri: uri,
			newUri: workspacePath('new File.textile'), // Rename on disk should use file extension
		}, {
			uri: uri, edits: [
				new vscode.TextEdit(new vscode.Range(0, 7, 0, 11), '/new%20File'), // Links should continue to use extension-less paths
				new vscode.TextEdit(new vscode.Range(1, 5, 1, 9), '/new%20File'),
			]
		});
	});

	// TODO: fails on windows
	test.skip('Path rename should use correctly resolved paths across files', async () => {
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

		const edit = await getRenameEdits(doc1, new vscode.Position(0, 10), './new/new-doc.textile', new InMemoryWorkspaceTextileDocuments([
			doc1, doc2, doc3, doc4,
		]));
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
	});

	test('Path rename should resolve on links without prefix', async () => {
		const uri1 = workspacePath('sub', 'doc.textile');
		const doc1 = new InMemoryDocument(uri1, joinLines(
			`!images/cat.gif(text)!`,
		));

		const uri2 = workspacePath('doc2.md');
		const doc2 = new InMemoryDocument(uri2, joinLines(
			`!sub/images/cat.gif(text)!`,
		));

		const edit = await getRenameEdits(doc1, new vscode.Position(0, 10), 'img/cat.gif', new InMemoryWorkspaceTextileDocuments([
			doc1, doc2,
		]));
		assertEditsEqual(edit!, {
			originalUri: workspacePath('sub', 'images', 'cat.gif'),
			newUri: workspacePath('sub', 'img', 'cat.gif'),
		}, {
			uri: uri1, edits: [new vscode.TextEdit(new vscode.Range(0, 1, 0, 15), 'img/cat.gif')]
		}, {
			uri: uri2, edits: [new vscode.TextEdit(new vscode.Range(0, 1, 0, 19), 'sub/img/cat.gif')]
		});
	});

	test('Rename on link should use header text as placeholder', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h3. a B c`,
			``,
			`[text]#a-b-c`,
		));

		const info = await prepareRename(doc, new vscode.Position(2, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.strictEqual(info!.placeholder, 'a B c');
		assertRangeEqual(info!.range, new vscode.Range(2, 7, 2, 12));
	});

	test('Rename on http uri should work', async () => {
		const uri1 = workspacePath('doc.textile');
		const uri2 = workspacePath('doc2.textile');
		const doc = new InMemoryDocument(uri1, joinLines(
			`"1":http://example.com`,
			`[2]http://example.com`,
			// not relevant for textile : `<http://example.com>`,
		));

		const edit = await getRenameEdits(doc, new vscode.Position(1, 10), "https://example.com/sub", new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(uri2, joinLines(
				`"4":http://example.com`,
			))
		]));
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
	});
});
