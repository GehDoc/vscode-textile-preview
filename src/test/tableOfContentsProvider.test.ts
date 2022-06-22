/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TableOfContents } from '../tableOfContentsProvider';
import { createNewTextileEngine } from './engine';
import { InMemoryDocument } from './inMemoryDocument';

const testFileName = vscode.Uri.file('test.md');

suite('textile.TableOfContentsProvider', () => {
	test('Lookup should not return anything for empty document', async () => {
		const doc = new InMemoryDocument(testFileName, '');
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual(provider.lookup(''), undefined);
		assert.strictEqual(provider.lookup('foo'), undefined);
	});

	test('Lookup should not return anything for document with no headers', async () => {
		const doc = new InMemoryDocument(testFileName, 'a *b*\nc');
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual(provider.lookup(''), undefined);
		assert.strictEqual(provider.lookup('foo'), undefined);
		assert.strictEqual(provider.lookup('a'), undefined);
		assert.strictEqual(provider.lookup('b'), undefined);
	});

	// -- Begin : changed for textile
	test('Lookup should return basic #header', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. a\n\nx\n\nh1. c`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		{
			const entry = provider.lookup('a');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 0);
		}
		{
			assert.strictEqual(provider.lookup('x'), undefined);
		}
		{
			const entry = provider.lookup('c');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 4);
		}
	});

	test('Lookups should be case in-sensitive', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. fOo\n`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual((provider.lookup('fOo'))!.line, 0);
		assert.strictEqual((provider.lookup('foo'))!.line, 0);
		assert.strictEqual((provider.lookup('FOO'))!.line, 0);
	});

	test('Lookups should ignore leading and trailing white-space, and collapse internal whitespace', async () => {
		const doc = new InMemoryDocument(testFileName, `h1.      f o  o    \n`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual((provider.lookup('f o  o'))!.line, 0);
		assert.strictEqual((provider.lookup('  f o  o'))!.line, 0);
		assert.strictEqual((provider.lookup('  f o  o  '))!.line, 0);
		assert.strictEqual((provider.lookup('f o o'))!.line, 0);
		assert.strictEqual((provider.lookup('f o       o'))!.line, 0);

		assert.strictEqual(provider.lookup('f'), undefined);
		assert.strictEqual(provider.lookup('foo'), undefined);
		assert.strictEqual(provider.lookup('fo o'), undefined);
	});

	test('should handle special characters #44779', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. Indentação\n`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual((provider.lookup('indentação'))!.line, 0);
	});

	test('should handle special characters 2, #48482', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. Инструкция - Делай Раз, Делай Два\n`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual((provider.lookup('инструкция---делай-раз-делай-два'))!.line, 0);
	});

	test('should handle special characters 3, #37079', async () => {
		const doc = new InMemoryDocument(testFileName, `h2. Header 2

h3. Header 3

h2. Заголовок 2

h3. Заголовок 3

h3. Заголовок Header 3

h2. Заголовок`);

		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		assert.strictEqual((provider.lookup('header-2'))!.line, 0);
		assert.strictEqual((provider.lookup('header-3'))!.line, 2);
		assert.strictEqual((provider.lookup('Заголовок-2'))!.line, 4);
		assert.strictEqual((provider.lookup('Заголовок-3'))!.line, 6);
		assert.strictEqual((provider.lookup('Заголовок-header-3'))!.line, 8);
		assert.strictEqual((provider.lookup('Заголовок'))!.line, 10);
	});

	test('Lookup should support suffixes for repeated headers', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. a\n\nh1. a\n\nh2. a`);
		const provider = await TableOfContents.create(createNewTextileEngine(), doc);

		{
			const entry = provider.lookup('a');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 0);
		}
		{
			const entry = provider.lookup('a-1');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 2);
		}
		{
			const entry = provider.lookup('a-2');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 4);
		}
	});
	// -- End : changed for textile
});
