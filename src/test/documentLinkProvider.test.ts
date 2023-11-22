/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLink, TextileLinkComputer, TextileLinkProvider, TextileVsCodeLinkProvider } from '../languageFeatures/documentLinks';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { assertRangeEqual, joinLines, workspacePath } from './util';


suite('Textile: TextileLinkComputer', () => {

	function getLinksForFile(fileContents: string): Promise<TextileLink[]> {
		const doc = new InMemoryDocument(workspacePath('x.textile'), fileContents);
		const engine = createNewTextileEngine();
		const linkProvider = new TextileLinkComputer(engine);
		return linkProvider.getAllLinks(doc, noopToken);
	}

	function assertLinksEqual(actualLinks: readonly TextileLink[], expected: ReadonlyArray<vscode.Range | { readonly range: vscode.Range; readonly sourceText: string }>) {
		assert.strictEqual(actualLinks.length, expected.length);

		for (let i = 0; i < actualLinks.length; ++i) {
			const exp = expected[i];
			if ('range' in exp) {
				assertRangeEqual(actualLinks[i].source.hrefRange, exp.range, `Range ${i} to be equal`);
				assert.strictEqual(actualLinks[i].source.hrefText, exp.sourceText, `Source text ${i} to be equal`);
			} else {
				assertRangeEqual(actualLinks[i].source.hrefRange, exp, `Range ${i} to be equal`);
			}
		}
	}

	test('Should not return anything for empty document', async () => {
		const links = await getLinksForFile('');
		assertLinksEqual(links, []);
	});

	test('Should not return anything for simple document without links', async () => {
		const links = await getLinksForFile(joinLines(
			'h1. a',
			'fdasfdfsafsa',
		));
		assertLinksEqual(links, []);
	});

	test('Should detect basic http links', async () => {
		const links = await getLinksForFile('a "b":https://example.com c');
		assertLinksEqual(links, [
			new vscode.Range(0, 6, 0, 25)
		]);
	});

	test('Should detect basic workspace links', async () => {
		{
			const links = await getLinksForFile('a "b":./file c');
			assertLinksEqual(links, [
				new vscode.Range(0, 6, 0, 12)
			]);
		}
		{
			const links = await getLinksForFile('a "b":file.png c');
			assertLinksEqual(links, [
				new vscode.Range(0, 6, 0, 14)
			]);
		}
	});

	test('Should detect links with title', async () => {
		const links = await getLinksForFile('a "b(abc)":https://example.com c');
		assertLinksEqual(links, [
			new vscode.Range(0, 11, 0, 30)
		]);
	});

	/* FIXME : failing for textile syntax
	// https://github.com/microsoft/vscode/issues/35245
	test('Should handle links with escaped characters in name (#35245)', async () => {
		const links = await getLinksForFile('a [b\\]](./file)');
		assertLinksEqual(links, [
			new vscode.Range(0, 8, 0, 14)
		]);
	});
	*/

	test('Should handle links with balanced parens', async () => {
		{
			const links = await getLinksForFile('a "b":https://example.com/a()c c');
			assertLinksEqual(links, [
				new vscode.Range(0, 6, 0, 30)
			]);
		}
		{
			const links = await getLinksForFile('a "b":https://example.com/a(b)c c');
			assertLinksEqual(links, [
				new vscode.Range(0, 6, 0, 31)
			]);

		}
		{
			// https://github.com/microsoft/vscode/issues/49011
			const links = await getLinksForFile('"A link":http://ThisUrlhasParens/A_link(in_parens)');
			assertLinksEqual(links, [
				new vscode.Range(0, 9, 0, 50)
			]);
		}
	});

	// vscode issue (#150921)
	test('Should ignore quoted text inside link title', async () => {
		{
			const links = await getLinksForFile('"some "inner" in title":link');
			assertLinksEqual(links, [
				new vscode.Range(0, 24, 0, 28),
			]);
		}
		/* Disabled for textile : Not relevant
		{
			const links = await getLinksForFile('[some [inner] in title](<link>)');
			assertLinksEqual(links, [
				new vscode.Range(0, 25, 0, 29),
			]);
		}
		*/
		{
			const links = await getLinksForFile('"some "inner with space" in title":link');
			assertLinksEqual(links, [
				new vscode.Range(0, 35, 0, 39),
			]);
		}
	});


	/* Disabled for textile : Not relevant
	test('Should handle two links without space', async () => {
		const links = await getLinksForFile('a ([test](test)[test2](test2)) c');
		assertLinksEqual(links, [
			new vscode.Range(0, 10, 0, 14),
			new vscode.Range(0, 23, 0, 28)
		]);
	});
	*/

	test('Should handle Markdown-style links', async () => {
		const links = await getLinksForFile('a ["b":link with space] c');
		assertLinksEqual(links, [
			new vscode.Range(0, 7, 0, 22),
		]);
	});

	test('Should handle link aliases', async () => {
		const links = await getLinksForFile('a "b":example c\n[example]https://example.com');
		assertLinksEqual(links, [
			new vscode.Range(0, 6, 0, 13),
			new vscode.Range(1, 9, 1, 28),
		]);
	});

	// https://github.com/microsoft/vscode/issues/49238
	test('should handle hyperlinked images', async () => {
		{
			const links = await getLinksForFile('!image.jpg(alt text)!:https://example.com');
			assertLinksEqual(links, [
				new vscode.Range(0, 1, 0, 10),
				new vscode.Range(0, 22, 0, 41),
			]);
		}
		{
			const links = await getLinksForFile('!>image.jpg(alt text)!:https://example.com');
			assertLinksEqual(links, [
				new vscode.Range(0, 2, 0, 11),
				new vscode.Range(0, 23, 0, 42),
			]);
		}
		/* Disabled for textile : Not relevant
		{
			const links = await getLinksForFile('[![a]( whitespace.jpg )]( https://whitespace.com )');
			assertLinksEqual(links, [
				new vscode.Range(0, 26, 0, 48),
				new vscode.Range(0, 7, 0, 21),
			]);
		}
		*/
		{
			const links = await getLinksForFile('!img1.jpg(a)!:file1.txt text !img2.jpg(a)!:file2.txt');
			assertLinksEqual(links, [
				new vscode.Range(0, 1, 0, 9),
				new vscode.Range(0, 14, 0, 23),
				new vscode.Range(0, 30, 0, 38),
				new vscode.Range(0, 43, 0, 52),
			]);
		}
	});

	// -- Begin: Modified for textile
	// https://github.com/microsoft/vscode/issues/107471
	test('Can consider link references starting with ^ character valid (#107471)', async () => {
		const links = await getLinksForFile('[^reference]https://example.com');
		assert.strictEqual(links.length, 1);
	});

	// https://github.com/microsoft/vscode/issues/136073
	test('Should not find definitions links with spaces in angle brackets (#136073)', async () => {
		const links = await getLinksForFile(joinLines(
			'[a]<b c>',
			'[b]<cd>',
		));

		assertLinksEqual(links, []);
	});

	// https://github.com/microsoft/vscode/issues/141285
	test('Should only find one link for reference sources [a]source (#141285)', async () => {
		const links = await getLinksForFile(joinLines(
			'[Works]https://example.com',
		));

		assertLinksEqual(links, [
			{ range: new vscode.Range(0, 7, 0, 26), sourceText: 'https://example.com' },
		]);
	});

	// https://github.com/microsoft/vscode/issues/141285
	test('Should not find link for referees with only one [] (#141285)', async () => {
		const links = await getLinksForFile(joinLines(
			'[ref]',
			'[ref]https://example.com',
		));
		assertLinksEqual(links, [
			{ range: new vscode.Range(1, 5, 1, 24), sourceText: 'https://example.com' },
		]);
	});

	/* Disabled for textile : Not relevant
	// https://github.com/microsoft/vscode/issues/141285
	test('Should find reference link shorthand using empty closing brackets (#141285)', async () => {
		const links = await getLinksForFile(joinLines(
			'[ref][]',
		));
		assertLinksEqual(links, [
			new vscode.Range(0, 1, 0, 4),
		]);
	});

	test.skip('Should find reference link shorthand for link with space in label (#141285)', async () => {
		const links = await getLinksForFile(joinLines(
			'[ref with space]',
		));
		assertLinksEqual(links, [
			new vscode.Range(0, 7, 0, 26),
		]);
	});

	test('Should not include reference links with escaped leading brackets', async () => {
		const links = await getLinksForFile(joinLines(
			`\\[bad link][good]`,
			`\\[good]`,
			`[good]: http://example.com`,
		));
		assertLinksEqual(links, [
			new vscode.Range(2, 8, 2, 26) // Should only find the definition
		]);
	});
	*/

	test('Should not consider links in code fenced with bc.', async () => {
		const text = joinLines(
			'bc. b is',
			'"b":https://example.com',
			'');
		const links = await getLinksForFile(text);
		assertLinksEqual(links, []);
	});

	test('Should not consider links in code fenced with code tag', async () => {
		const text = joinLines(
			'<code>',
			'"b":https://example.com',
			'</code>');
		const links = await getLinksForFile(text);
		assertLinksEqual(links, []);
	});

	/* Disabled for textile : Not relevant
	test('Should not consider links in indented code', async () => {
		const links = await getLinksForFile('    "b":https://example.com');
		assertLinksEqual(links, []);
	});
	*/

	test('Should not consider links in inline code span', async () => {
		const links = await getLinksForFile('@"b":https://example.com@');
		assertLinksEqual(links, []);
	});

	test('Should not consider links with code span inside', async () => {
		const links = await getLinksForFile('"li@nk":https://example.com@');
		assertLinksEqual(links, []);
	});

	/* FIXME in textile-js
	test('Should not consider links in multiline inline code span', async () => {
		const links = await getLinksForFile(joinLines(
			'@',
			'"b":https://example.com',
			'@');
		assertLinksEqual(links, []);
	});
	*/

	test('Should not consider link references in code fenced with bc.', async () => {
		const links = await getLinksForFile(joinLines(
			'bc. [a]bb',
			''));
		assertLinksEqual(links, []);
	});

	test('Should not consider reference sources in code fenced with bc. (#146714)', async () => {
		const links = await getLinksForFile(joinLines(
			'bc. [a]http://example.com',
			''));
		assertLinksEqual(links, []);
	});

	/* FIXME in textile-js
	test('Should not consider links in multiline inline code span between between text', async () => {
		const text = joinLines(
			'"b":https://1.com @"b":https://2.com',
			'@ "b":https://3.com');
		const links = await getLinksForFile(text);
		assert.deepStrictEqual(links.map(l => l.target?.authority), ['1.com', '3.com']);
	});

	test('Should not consider links in multiline inline code span with new line after the first at', async () => {
		const text = joinLines(
			'@',
			'"b":https://example.com @');
		assertLinksEqual(links, []);
	});

	test('Should not miss links in invalid multiline inline code span', async () => {
		const text = joinLines(
			'`` ',
			'',
			'[b](https://example.com)',
			'',
			'``');
		const links = await getLinksForFile(text);
		assert.strictEqual(links.length, 1);
	});
	*/

	test('Should find autolinks', async () => {
		const links = await getLinksForFile('pre "$":http://example.com> post');
		assertLinksEqual(links, [
			new vscode.Range(0, 8, 0, 26)
		]);
	});

	test('Should not detect links inside html comment blocks', async () => {
		const links = await getLinksForFile(joinLines(
			`<!-- "text":./foo.textile -->`,
			`<!-- [text]./foo.textile -->`,
			``,
			`<!--`,
			`"text":./foo.textile`,
			`-->`,
			``,
			`<!--`,
			`[text]./foo.textile`,
			`-->`,
		));
		assertLinksEqual(links, []);
	});

	test('Should not detect links inside inline html comments', async () => {
		const links = await getLinksForFile(joinLines(
			`text <!-- "text":./foo.textile --> text`,
			`text <!-- [text]./foo.textile --> text`,
			``,
			`text <!--`,
			`"text":./foo.textile`,
			`--> text`,
			``,
			`text <!--`,
			`[text]./foo.textile`,
			`--> text`,
		));
		assertLinksEqual(links, []);
	});

	/* Disabled : not relevant for Textile
	test('Should not mark checkboxes as links', async () => {
		const links = await getLinksForFile(joinLines(
			'- [x]',
			'- [X]',
			'- [ ]',
			'* [x]',
			'* [X]',
			'* [ ]',
			``,
			`[x]: http://example.com`
		));
		assertLinksEqual(links, [
			new vscode.Range(7, 5, 7, 23)
		]);
	});

	test('Should still find links on line with checkbox', async () => {
		const links = await getLinksForFile(joinLines(
			'- [x] [x]',
			'- [X] [x]',
			'- [] [x]',
			``,
			`[x]: http://example.com`
		));

		assertLinksEqual(links, [
			new vscode.Range(0, 7, 0, 8),
			new vscode.Range(1, 7, 1, 8),
			new vscode.Range(2, 6, 2, 7),
			new vscode.Range(4, 5, 4, 23),
		]);
	});

	test('Should find link only within angle brackets.', async () => {
		const links = await getLinksForFile(joinLines(
			`[link](<path>)`
		));
		assertLinksEqual(links, [new vscode.Range(0, 8, 0, 12)]);
	});

	test('Should find link within angle brackets even with link title.', async () => {
		const links = await getLinksForFile(joinLines(
			`[link](<path> "test title")`
		));
		assertLinksEqual(links, [new vscode.Range(0, 8, 0, 12)]);
	});

	test('Should find link within angle brackets even with surrounding spaces.', async () => {
		const links = await getLinksForFile(joinLines(
			`[link]( <path> )`
		));
		assertLinksEqual(links, [new vscode.Range(0, 9, 0, 13)]);
	});

	test('Should find link within angle brackets for image hyperlinks.', async () => {
		const links = await getLinksForFile(joinLines(
			`![link](<path>)`
		));
		assertLinksEqual(links, [new vscode.Range(0, 9, 0, 13)]);
	});

	test('Should find link with spaces in angle brackets for image hyperlinks with titles.', async () => {
		const links = await getLinksForFile(joinLines(
			`![link](< path > "test")`
		));
		assertLinksEqual(links, [new vscode.Range(0, 9, 0, 15)]);
	});


	test('Should not find link due to incorrect angle bracket notation or usage.', async () => {
		const links = await getLinksForFile(joinLines(
			`[link](<path )`,
			`[link](<> path>)`,
			`[link](> path)`,
		));
		assertLinksEqual(links, []);
	});

	test('Should find link within angle brackets even with space inside link.', async () => {

		const links = await getLinksForFile(joinLines(
			`[link](<pa th>)`
		));

		assertLinksEqual(links, [new vscode.Range(0, 8, 0, 13)]);
	});
	*/

	test('Should find links with titles', async () => {
		const links = await getLinksForFile(joinLines(
			//`[link](<no such.md> "text")`,
			//`[link](<no such.md> 'text')`,
			//`[link](<no such.md> (text))`,
			//`[link]no-such.md "text")`,
			//`[link]no-such.md 'text')`,
			`"link(text)":no-such.textile`,
		));
		assertLinksEqual(links, [
			new vscode.Range(0, 13, 0, 28),
		]);
	});

	/* Disabled : not relevant for Textile
	test('Should not include link with empty angle bracket', async () => {
		const links = await getLinksForFile(joinLines(
			`[](<>)`,
			`[link](<>)`,
			`[link](<> "text")`,
			`[link](<> 'text')`,
			`[link](<> (text))`,
		));
		assertLinksEqual(links, []);
	});
	*/

	// -- End: Modified for textile
});


suite('Textile: VS Code DocumentLinkProvider', () => {

	function getLinksForFile(fileContents: string) {
		const doc = new InMemoryDocument(workspacePath('x.textile'), fileContents);
		const workspace = new InMemoryTextileWorkspace([doc]);

		const engine = createNewTextileEngine();
		const linkProvider = new TextileLinkProvider(engine, workspace, nulLogger);
		const provider = new TextileVsCodeLinkProvider(linkProvider);
		return provider.provideDocumentLinks(doc, noopToken);
	}

	function assertLinksEqual(actualLinks: readonly vscode.DocumentLink[], expectedRanges: readonly vscode.Range[]) {
		assert.strictEqual(actualLinks.length, expectedRanges.length);

		for (let i = 0; i < actualLinks.length; ++i) {
			assertRangeEqual(actualLinks[i].range, expectedRanges[i], `Range ${i} to be equal`);
		}
	}

	test('Should include defined reference links (#141285)', async () => {
		const links = await getLinksForFile(joinLines(
			'[ref]',
			//'[ref][]', // Not relevant for Textile
			'[ref]ref', // Not a reference in Textile
			'',
			'[ref]http://example.com'
		));
		assertLinksEqual(links, [
			new vscode.Range(3, 5, 3, 23),
		]);
	});

	/* Disabled for Textile : not relevant
	test('Should not include reference link shorthand when definition does not exist (#141285)', async () => {
		const links = await getLinksForFile('[ref]');
		assertLinksEqual(links, []);
	});
	*/
});
