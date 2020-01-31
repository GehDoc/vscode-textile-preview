/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import LinkProvider from '../features/documentLinkProvider';
import { InMemoryDocument } from './inMemoryDocument';


const testFileName = vscode.Uri.file('test.md');

const noopToken = new class implements vscode.CancellationToken {
	private _onCancellationRequestedEmitter = new vscode.EventEmitter<void>();
	public onCancellationRequested = this._onCancellationRequestedEmitter.event;

	get isCancellationRequested() { return false; }
};

function getLinksForFile(fileContents: string) {
	const doc = new InMemoryDocument(testFileName, fileContents);
	const provider = new LinkProvider();
	return provider.provideDocumentLinks(doc, noopToken);
}

function assertRangeEqual(expected: vscode.Range, actual: vscode.Range) {
	assert.strictEqual(expected.start.line, actual.start.line);
	assert.strictEqual(expected.start.character, actual.start.character);
	assert.strictEqual(expected.end.line, actual.end.line);
	assert.strictEqual(expected.end.character, actual.end.character);
}

suite('textile.DocumentLinkProvider', () => {
	test('Should not return anything for empty document', () => {
		const links = getLinksForFile('');
		assert.strictEqual(links.length, 0);
	});

	test('Should not return anything for simple document without links', () => {
		const links = getLinksForFile('# a\nfdasfdfsafsa');
		assert.strictEqual(links.length, 0);
	});

	test('Should detect basic http links', () => {
		const links = getLinksForFile('a "b":https://example.com c');
		assert.strictEqual(links.length, 1);
		const [link] = links;
		assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 25));
	});

	test('Should detect basic workspace links', () => {
		{
			const links = getLinksForFile('a "b":./file c');
			assert.strictEqual(links.length, 1);
			const [link] = links;
			assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 12));
		}
		{
			const links = getLinksForFile('a "b":file.png c');
			assert.strictEqual(links.length, 1);
			const [link] = links;
			assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 14));
		}
	});

	test('Should detect links with title', () => {
		const links = getLinksForFile('a "b(abc)":https://example.com c');
		assert.strictEqual(links.length, 1);
		const [link] = links;
		assertRangeEqual(link.range, new vscode.Range(0, 11, 0, 30));
	});

	/* FIXME : failing for textile syntax
	// #35245 (vscode)
	test('Should handle links with escaped characters in name', () => {
		const links = getLinksForFile('a "b\\"":./file');
		assert.strictEqual(links.length, 1);
		const [link] = links;
		assertRangeEqual(link.range, new vscode.Range(0, 8, 0, 14));
	});
	*/

	test('Should handle links with balanced parens', () => {
		{
			const links = getLinksForFile('a "b":https://example.com/a()c c');
			assert.strictEqual(links.length, 1);
			const [link] = links;
			assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 30));
		}
		{
			const links = getLinksForFile('a "b":https://example.com/a(b)c c');
			assert.strictEqual(links.length, 1);
			const [link] = links;
			assertRangeEqual(link.range, new vscode.Range(0, 6, 0, 31));

		}
		{
			// #49011 (vscode)
			const links = getLinksForFile('"A link":http://ThisUrlhasParens/A_link(in_parens)');
			assert.strictEqual(links.length, 1);
			const [link] = links;
			assertRangeEqual(link.range, new vscode.Range(0, 9, 0, 50));
		}
	});

	/* Disabled: Not relevant for textile
	test('Should handle two links without space', () => {
		const links = getLinksForFile('a ([test](test)[test2](test2)) c');
		assert.strictEqual(links.length, 2);
		const [link1, link2] = links;
		assertRangeEqual(link1.range, new vscode.Range(0, 10, 0, 14));
		assertRangeEqual(link2.range, new vscode.Range(0, 23, 0, 28));
	});
	*/

	test('Should handle Markdown-style links', () => {
		const links = getLinksForFile('a ["b":link with space] c');
		assert.strictEqual(links.length, 1);
		const [link1] = links;
		assertRangeEqual(link1.range, new vscode.Range(0, 7, 0, 22));
	});

	// #49238 (vscode)
	test('should handle hyperlinked images', () => {
		{
			const links = getLinksForFile('!image.jpg(alt text)!:https://example.com');
			assert.strictEqual(links.length, 2);
			const [link1, link2] = links;
			assertRangeEqual(link1.range, new vscode.Range(0,1,0,10));
			assertRangeEqual(link2.range, new vscode.Range(0,22,0,41));
		}
		{
			const links = getLinksForFile('!>image.jpg(alt text)!:https://example.com');
			assert.strictEqual(links.length, 2);
			const [link1, link2] = links;
			assertRangeEqual(link1.range, new vscode.Range(0,2,0,11));
			assertRangeEqual(link2.range, new vscode.Range(0,23,0,42));
		}
		/* Disabled: Not relevant for textile
		{
			const links = getLinksForFile('[![a]( whitespace.jpg )]( https://whitespace.com )');
			assert.strictEqual(links.length, 2);
			const [link1, link2] = links;
			assertRangeEqual(link1.range, new vscode.Range(0,7,0,21));
			assertRangeEqual(link2.range, new vscode.Range(0,26,0,48));
		}
		*/
		{
			const links = getLinksForFile('!img1.jpg(a)!:file1.txt text !img2.jpg(a)!:file2.txt');
			assert.strictEqual(links.length, 4);
			const [link1, link2, link3, link4] = links;
			assertRangeEqual(link1.range, new vscode.Range(0,1,0,9));
			assertRangeEqual(link2.range, new vscode.Range(0,14,0,23));
			assertRangeEqual(link3.range, new vscode.Range(0,30,0,38));
			assertRangeEqual(link4.range, new vscode.Range(0,43,0,52));
		}
	});
});


