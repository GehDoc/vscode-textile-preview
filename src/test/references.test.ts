/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLinkProvider } from '../languageFeatures/documentLinkProvider';
import { TextileReferencesProvider } from '../languageFeatures/references';
import { githubSlugifier } from '../slugify';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { TextileWorkspaceContents } from '../workspaceContents';
import { createNewTextileEngine } from './engine';
import { InMemoryWorkspaceTextileDocuments } from './inMemoryWorkspace';
import { joinLines, workspacePath } from './util';


function getReferences(doc: InMemoryDocument, pos: vscode.Position, workspaceContents: TextileWorkspaceContents) {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const provider = new TextileReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	return provider.provideReferences(doc, pos, { includeDeclaration: true }, noopToken);
}

function assertReferencesEqual(actualRefs: readonly vscode.Location[], ...expectedRefs: { uri: vscode.Uri; line: number; startCharacter?: number; endCharacter?: number }[]) {
	assert.strictEqual(actualRefs.length, expectedRefs.length, `Reference counts should match`);

	for (let i = 0; i < actualRefs.length; ++i) {
		const actual = actualRefs[i];
		const expected = expectedRefs[i];
		assert.strictEqual(actual.uri.toString(), expected.uri.toString(), `Ref '${i}' has expected document`);
		assert.strictEqual(actual.range.start.line, expected.line, `Ref '${i}' has expected start line`);
		assert.strictEqual(actual.range.end.line, expected.line, `Ref '${i}' has expected end line`);
		if (typeof expected.startCharacter !== 'undefined') {
			assert.strictEqual(actual.range.start.character, expected.startCharacter, `Ref '${i}' has expected start character`);
		}
		if (typeof expected.endCharacter !== 'undefined') {
			assert.strictEqual(actual.range.end.character, expected.endCharacter, `Ref '${i}' has expected end character`);
		}
	}
}

suite('textile: find all references', () => {
	test('Should not return references when not on header or link', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
			`text`,
		));

		{
			const refs = await getReferences(doc, new vscode.Position(1, 0), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs, []);
		}
		{
			const refs = await getReferences(doc, new vscode.Position(3, 2), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs, []);
		}
	});

	test('Should find references from header within same file', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
			`"not link":#noabc`,
			`"link 2":#abc`,
		));
		const refs = await getReferences(doc, new vscode.Position(0, 3), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 },
			{ uri, line: 2 },
			{ uri, line: 4 },
		);
	});

	test('Should not return references when on link text', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`"ref":#abc`,
			`[ref]: http://example.com`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 1), new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(refs, []);
	});

	test('Should find references using normalized slug', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`h1. a B c`,
			`"simple":#a-b-c`,
			`"start underscore":#_a-b-c`,
			`"different case":#a-B-C`,
		));

		{
			// Trigger header
			const refs = await getReferences(doc, new vscode.Position(0, 0), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs!.length, 4);
		}
		{
			// Trigger on line 1
			const refs = await getReferences(doc, new vscode.Position(1, 12), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs!.length, 4);
		}
		{
			// Trigger on line 2
			const refs = await getReferences(doc, new vscode.Position(2, 24), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs!.length, 4);
		}
		{
			// Trigger on line 3
			const refs = await getReferences(doc, new vscode.Position(3, 20), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.deepStrictEqual(refs!.length, 4);
		}
	});

	test('Should find references from header across files', async () => {
		const docUri = workspacePath('doc.textile');
		const other1Uri = workspacePath('sub', 'other.textile');
		const other2Uri = workspacePath('other2.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
		));
		const refs = await getReferences(doc, new vscode.Position(0, 3), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(other1Uri, joinLines(
				`"not link":#abc`,
				`"not link":/doc.textile#abz`,
				`"link":/doc.textile#abc`,
			)),
			new InMemoryDocument(other2Uri, joinLines(
				`"not link":#abc`,
				`"not link":./doc.textile#abz`,
				`"link":./doc.textile#abc`,
			))
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 0 }, // Header definition
			{ uri: docUri, line: 2 },
			{ uri: other1Uri, line: 2 },
			{ uri: other2Uri, line: 2 },
		);
	});

	test('Should find references from header to link definitions ', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. abc`,
			``,
			`[bla]#abc`
		));

		const refs = await getReferences(doc, new vscode.Position(0, 3), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 }, // Header definition
			{ uri, line: 2 },
		);
	});

	test('Should find header references from link definition', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. A b C`,
			`"text":bla`,
			`[bla]#a-b-c`, // trigger here
		));

		const refs = await getReferences(doc, new vscode.Position(2, 9), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 }, // Header definition
			{ uri, line: 2 },
		);
	});

	test('Should find references from link within same file', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
			`"not link":#noabc`,
			`"link 2":#abc`,
		));

		const refs = await getReferences(doc, new vscode.Position(2, 10), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 }, // Header definition
			{ uri, line: 2 },
			{ uri, line: 4 },
		);
	});

	test('Should find references from link across files', async () => {
		const docUri = workspacePath('doc.textile');
		const other1Uri = workspacePath('sub', 'other.textile');
		const other2Uri = workspacePath('other2.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
		));
		const refs = await getReferences(doc, new vscode.Position(2, 10), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(other1Uri, joinLines(
				`"not link":#abc`,
				`"not link":/doc.textile#abz`,
				`"with ext":/doc.textile#abc`,
				`"without ext":/doc#abc`,
			)),
			new InMemoryDocument(other2Uri, joinLines(
				`"not link":#abc`,
				`"not link":./doc.textile#abz`,
				`"link":./doc.textile#abc`,
			))
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 0 }, // Header definition
			{ uri: docUri, line: 2 },
			{ uri: other1Uri, line: 2 }, // Other with ext
			{ uri: other1Uri, line: 3 }, // Other without ext
			{ uri: other2Uri, line: 2 }, // Other2
		);
	});

	test('Should find references without requiring file extensions', async () => {
		const docUri = workspacePath('doc.textile');
		const other1Uri = workspacePath('other.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`h1. a B c`,
			``,
			`"link 1":#a-b-c`,
		));
		const refs = await getReferences(doc, new vscode.Position(2, 10), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(other1Uri, joinLines(
				`"not link":#a-b-c`,
				`"not link":/doc.textile#a-b-z`,
				`"with ext":/doc.textile#a-b-c`,
				`"without ext":/doc#a-b-c`,
				`"rel with ext":./doc.textile#a-b-c`,
				`"rel without ext":./doc#a-b-c`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 0 }, // Header definition
			{ uri: docUri, line: 2 },
			{ uri: other1Uri, line: 2 }, // Other with ext
			{ uri: other1Uri, line: 3 }, // Other without ext
			{ uri: other1Uri, line: 4 }, // Other relative link with ext
			{ uri: other1Uri, line: 5 }, // Other relative link without ext
		);
	});

	test('Should find references from link across files when triggered on link without file extension', async () => {
		const docUri = workspacePath('doc.textile');
		const other1Uri = workspacePath('sub', 'other.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`"with ext":./sub/other#header`,
			`"without ext":./sub/other.textile#header`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 23), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(other1Uri, joinLines(
				`pre`,
				``, // modified for textile
				`h1. header`,
				``, // modified for textile
				`post`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: other1Uri, line: 2 }, // Header definition
			{ uri: docUri, line: 0 },
			{ uri: docUri, line: 1 },
		);
	});

	test('Should include header references when triggered on file link', async () => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('sub', 'other.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`"with ext":./sub/other`,
			`"with ext":./sub/other#header`,
			`"without ext":./sub/other.textile#no-such-header`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 15), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(otherUri, joinLines(
				`pre`,
				``, // modified for textile
				`h1. header`, // Definition should not be included since we triggered on a file link
				``, // modified for textile
				`post`,
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 0 },
			{ uri: docUri, line: 1 },
			{ uri: docUri, line: 2 },
		);
	});

	test('Should not include refs from other file to own header', async () => {
		const docUri = workspacePath('doc.textile');
		const otherUri = workspacePath('sub', 'other.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`"other":./sub/other`, // trigger here
		));

		const refs = await getReferences(doc, new vscode.Position(0, 15), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(otherUri, joinLines(
				`h1. header`, // Definition should not be included since we triggered on a file link
				``, // modified for textile
				`"text":#header`, // Ref should not be included since it is to own file
			)),
		]));

		assertReferencesEqual(refs!,
			{ uri: docUri, line: 0 },
		);
	});

	test('Should find explicit references to own file ', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"bare":doc.textile`, // trigger here
			`"rel":./doc.textile`,
			`"abs":/doc.textile`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 12), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 },
			{ uri, line: 1 },
			{ uri, line: 2 },
		);
	});

	test('Should support finding references to http uri', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"1":http://example.com`,
			`"no":https://example.com`,
			`"2":http://example.com`,
			`[3]http://example.com`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 13), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 },
			{ uri, line: 2 },
			{ uri, line: 3 },
		);
	});

	test('Should consider authority, scheme and paths when finding references to http uri', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`"1":http://example.com/cat`,
			`"2":http://example.com`,
			`"3":http://example.com/dog`,
			`"4":http://example.com/cat/looong`,
			`"5":http://example.com/cat`,
			`"6":http://other.com/cat`,
			`"7":https://example.com/cat`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 13), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 },
			{ uri, line: 4 },
		);
	});

	test('Should support finding references to http uri across files', async () => {
		const uri1 = workspacePath('doc.textile');
		const uri2 = workspacePath('doc2.textile');
		const doc = new InMemoryDocument(uri1, joinLines(
			`"1":http://example.com`,
			`[3]http://example.com`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 13), new InMemoryWorkspaceTextileDocuments([
			doc,
			new InMemoryDocument(uri2, joinLines(
				`"other":http://example.com`,
			))
		]));
		assertReferencesEqual(refs!,
			{ uri: uri1, line: 0 },
			{ uri: uri1, line: 1 },
			{ uri: uri2, line: 0 },
		);
	});

	/* Disabled for textile : not relevant
	test('Should support finding references to autolinked http links', async () => {
		const uri = workspacePath('doc.textile');
		const doc = new InMemoryDocument(uri, joinLines(
			`[1](http://example.com)`,
			`<http://example.com>`,
		));

		const refs = await getReferences(doc, new vscode.Position(0, 13), new InMemoryWorkspaceTextileDocuments([doc]));
		assertReferencesEqual(refs!,
			{ uri, line: 0 },
			{ uri, line: 1 },
		);
	});
	*/

	test('Should distinguish between references to file and to header within file', async () => {
		const docUri = workspacePath('doc.textile');
		const other1Uri = workspacePath('sub', 'other.textile');

		const doc = new InMemoryDocument(docUri, joinLines(
			`h1. abc`,
			``,
			`"link 1":#abc`,
		));
		const otherDoc = new InMemoryDocument(other1Uri, joinLines(
			`"link":/doc.textile#abc`,
			`"link no text":/doc#abc`,
		));
		const workspaceContents = new InMemoryWorkspaceTextileDocuments([
			doc,
			otherDoc,
		]);
		{
			// Check refs to header fragment
			const headerRefs = await getReferences(otherDoc, new vscode.Position(0, 21), workspaceContents);
			assertReferencesEqual(headerRefs!,
				{ uri: docUri, line: 0 }, // Header definition
				{ uri: docUri, line: 2 },
				{ uri: other1Uri, line: 0 },
				{ uri: other1Uri, line: 1 },
			);
		}
		{
			// Check refs to file itself from link with ext
			const fileRefs = await getReferences(otherDoc, new vscode.Position(0, 9), workspaceContents);
			assertReferencesEqual(fileRefs!,
				{ uri: other1Uri, line: 0, endCharacter: 19 },
				{ uri: other1Uri, line: 1, endCharacter: 19 },
			);
		}
		{
			// Check refs to file itself from link without ext
			const fileRefs = await getReferences(otherDoc, new vscode.Position(1, 17), workspaceContents);
			assertReferencesEqual(fileRefs!,
				{ uri: other1Uri, line: 0 },
				{ uri: other1Uri, line: 1 },
			);
		}
	});

	test('Should support finding references to unknown file', async () => {
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


		const refs = await getReferences(doc1, new vscode.Position(0, 10), new InMemoryWorkspaceTextileDocuments([doc1, doc2]));
		assertReferencesEqual(refs!,
			{ uri: uri1, line: 0 },
			{ uri: uri1, line: 2 },
			{ uri: uri2, line: 0 },
		);
	});

	suite('Reference links', () => {
		test('Should find reference links within file from link', async () => {
			const docUri = workspacePath('doc.textile');
			const doc = new InMemoryDocument(docUri, joinLines(
				`"link 1":abc`, // trigger here
				``,
				`[abc]https://example.com`,
			));

			const refs = await getReferences(doc, new vscode.Position(0, 10), new InMemoryWorkspaceTextileDocuments([doc]));
			assertReferencesEqual(refs!,
				{ uri: docUri, line: 0 },
				{ uri: docUri, line: 2 },
			);
		});

		test('Should find reference links using shorthand', async () => {
			const docUri = workspacePath('doc.textile');
			const doc = new InMemoryDocument(docUri, joinLines(
				'', // Not relevant for Textile `[ref]`, // trigger 1
				``,
				`"yes":ref`, // trigger 2
				``,
				`[ref]/Hello.textile` // trigger 3
			));

			/*{
				const refs = await getReferences(doc, new vscode.Position(0, 2), new InMemoryWorkspaceTextileDocuments([doc]));
				assertReferencesEqual(refs!,
					{ uri: docUri, line: 0 },
					{ uri: docUri, line: 2 },
					{ uri: docUri, line: 4 },
				);
			}*/
			{
				const refs = await getReferences(doc, new vscode.Position(2, 7), new InMemoryWorkspaceTextileDocuments([doc]));
				assertReferencesEqual(refs!,
					//{ uri: docUri, line: 0 },
					{ uri: docUri, line: 2 },
					{ uri: docUri, line: 4 },
				);
			}
			{
				const refs = await getReferences(doc, new vscode.Position(4, 2), new InMemoryWorkspaceTextileDocuments([doc]));
				assertReferencesEqual(refs!,
					//{ uri: docUri, line: 0 },
					{ uri: docUri, line: 2 },
					{ uri: docUri, line: 4 },
				);
			}
		});
		test('Should find reference links within file from definition', async () => {
			const docUri = workspacePath('doc.textile');
			const doc = new InMemoryDocument(docUri, joinLines(
				`"link 1":abc`,
				``,
				`[abc]https://example.com`, // trigger here
			));

			const refs = await getReferences(doc, new vscode.Position(2, 3), new InMemoryWorkspaceTextileDocuments([doc]));
			assertReferencesEqual(refs!,
				{ uri: docUri, line: 0 },
				{ uri: docUri, line: 2 },
			);
		});

		test('Should not find reference links across files', async () => {
			const docUri = workspacePath('doc.textile');
			const doc = new InMemoryDocument(docUri, joinLines(
				`"link 1":abc`,
				``,
				`[abc]https://example.com`,
			));

			const refs = await getReferences(doc, new vscode.Position(0, 12), new InMemoryWorkspaceTextileDocuments([
				doc,
				new InMemoryDocument(workspacePath('other.textile'), joinLines(
					`"link 1":abc`,
					``,
					`[abc]https://example.com?bad`,
				))
			]));
			assertReferencesEqual(refs!,
				{ uri: docUri, line: 0 },
				{ uri: docUri, line: 2 },
			);
		});

		/* Disabled : not relevant for Textile
		test('Should not consider checkboxes as reference links', async () => {
			const docUri = workspacePath('doc.textile');
			const doc = new InMemoryDocument(docUri, joinLines(
				`- [x]`,
				`- [X]`,
				`- [ ]`,
				``,
				`[x]: https://example.com`
			));

			const refs = await getReferences(doc, new vscode.Position(0, 4), new InMemoryWorkspaceTextileDocuments([doc]));
			assert.strictEqual(refs?.length!, 0);
		});
		*/
	});
});
