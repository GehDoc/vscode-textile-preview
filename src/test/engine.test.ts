/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { createNewTextileEngine } from './engine';
import { InMemoryDocument } from './inMemoryDocument';


const testFileName = vscode.Uri.file('test.md');

suite('textile.engine', () => {
	suite('rendering', () => {
		const input = 'h1. hello\n\nworld!';
		const output = '<h1 data-line="0" class="code-line" id="hello">hello</h1>\n'
			+ '<p data-line="2" class="code-line">world!</p>';

		test('Renders a document', async () => {
			const doc = new InMemoryDocument(testFileName, input);
			const engine = createNewTextileEngine();
			assert.strictEqual((await engine.render(doc)).html, output);
		});

		test('Renders a string', async () => {
			const engine = createNewTextileEngine();
			assert.strictEqual((await engine.render(input)).html, output);
		});
	});

	// -- Begin : Changed for textile
	suite('image-caching', () => {
		const input = '!img.png! "a":no-img.png !http://example.org/img.png! !img.png! !./img2.png!';

		test('Extracts all images', async () => {
			const engine = createNewTextileEngine();
			assert.deepStrictEqual((await engine.render(input)), {
				html: '<p data-line="0" class="code-line">'
					+ '<img src="img.png" data-line="0" class="code-line loading" alt="" id="image-hash--754511435" data-src="img.png" /> '
					+ '<a href="no-img.png" data-href="no-img.png">a</a> '
					+ '<img src="http://example.org/img.png" data-line="0" class="code-line loading" alt="" id="image-hash--1903814170" data-src="http://example.org/img.png" /> '
					+ '<img src="img.png" data-line="0" class="code-line loading" alt="" id="image-hash--754511435" data-src="img.png" /> '
					+ '<img src="./img2.png" data-line="0" class="code-line loading" alt="" id="image-hash-265238964" data-src="./img2.png" />'
					+ '</p>'
				,
				containingImages: [{ src: 'img.png' }, { src: 'http://example.org/img.png' }, { src: 'img.png' }, { src: './img2.png' }],
			});
		});
	});

	suite('code processing', () => {
		const input = 'example of @inline code@ in text block';
		const output = '<p data-line="0" class="code-line">example of <code>inline code</code> in text block</p>';

		test('Renders inline code', async () => {
			const engine = createNewTextileEngine();
			assert.strictEqual((await engine.render(input)).html, output);
		});
	});
	// -- End : Changed for textile
});
