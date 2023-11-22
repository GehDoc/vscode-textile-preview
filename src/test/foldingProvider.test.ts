/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileFoldingProvider } from '../languageFeatures/folding';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { joinLines, withStore } from './util';

const testFileName = vscode.Uri.file('test.textile');

async function getFoldsForDocument(store: DisposableStore, contents: string) {
	const doc = new InMemoryDocument(testFileName, contents);
	const workspace = store.add(new InMemoryTextileWorkspace([doc]));
	const engine = createNewTextileEngine();
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const provider = new TextileFoldingProvider(engine, tocProvider);
	return provider.provideFoldingRanges(doc, {}, noopToken);
}

suite('textile.FoldingProvider', () => {
	test('Should not return anything for empty document', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, ``);
		assert.strictEqual(folds.length, 0);
	}));

	// --- BEGIN : modified for textile
	test('Should not return anything for document without headers', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, joinLines(
			`a`,
			`**b** afas`,
			`a h1. b`,
			`a`,
		));
		assert.strictEqual(folds.length, 0);
	}));

	test('Should fold from header to end of document', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `a

h1. b

c
d`
		);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 2);
		assert.strictEqual(firstFold.end, 5);
	}));

	test('Should leave single newline before next header', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `
h1. a

x

h1. b

y`
		);
		assert.strictEqual(folds.length, 2);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 3);
	}));

	test('Should collapse multiple newlines to single newline before next header', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `
h1. a

x



h1. b

y`
		);
		assert.strictEqual(folds.length, 2);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 5);
	}));

	/* Disabled for textile : not relevant, if no newline between text and header, there is simply no header
	test('Should not collapse if there is no newline before next header', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, joinLines(
			``,
			`# a`,
			`x`,
			`# b`,
			`y`,
		));
		assert.strictEqual(folds.length, 2);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 2);
	}));
	*/

	test('Should fold nested <!-- #region --> markers', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `a
<!-- #region -->
b
<!-- #region hello!-->
b.a
<!-- #endregion -->
b
<!-- #region: foo! -->
b.b
<!-- #endregion: foo -->
b
<!-- #endregion -->
a`
		);
		assert.strictEqual(folds.length, 3);
		const [outer, first, second] = folds.sort((a, b) => a.start - b.start);

		assert.strictEqual(outer.start, 1);
		assert.strictEqual(outer.end, 11);
		assert.strictEqual(first.start, 3);
		assert.strictEqual(first.end, 5);
		assert.strictEqual(second.start, 7);
		assert.strictEqual(second.end, 9);
	}));

	test('Should fold from list to end of document', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `a
* b
c
d`
		);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 3);
	}));

	test('lists folds should span multiple lines of content', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, joinLines(
			`a`,
			`* This list item\n  spans multiple\n  lines.`
		));
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 3);
	}));

	test('List should leave single blankline before new element', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `* a
a


b`
		);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 0);
		assert.strictEqual(firstFold.end, 2);
	}));

	test('Should fold fenced code blocks', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `bc[ts].
a

b`);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 0);
		assert.strictEqual(firstFold.end, 1);
	}));

	test('Should fold fenced code blocks with yaml front matter', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `---
title: bla
---

bc[ts].
a

a
a
b
a`
		);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 4);
		assert.strictEqual(firstFold.end, 5);
	}));

	test('Should fold html blocks', withStore(async (store) => {
		const folds = await getFoldsForDocument(store, `x
<div>
	fa
</div>`);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 3);
	}));

	test('Should fold html block comments', withStore(async (store) => {
		const folds = await getFoldsForDocument(store,`x
<!--
fa
-->`);
		assert.strictEqual(folds.length, 1);
		const firstFold = folds[0];
		assert.strictEqual(firstFold.start, 1);
		assert.strictEqual(firstFold.end, 3);
		assert.strictEqual(firstFold.kind, vscode.FoldingRangeKind.Comment);
	}));
	// --- END : modified for textile
});
