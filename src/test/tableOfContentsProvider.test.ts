/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';

import { TableOfContentsProvider } from '../tableOfContentsProvider';
import { InMemoryDocument } from './inMemoryDocument';
import { createNewTextileEngine } from './engine';

const testFileName = vscode.Uri.file('test.md');

suite('textile.TableOfContentsProvider', () => {
	test('Lookup should not return anything for empty document', async () => {
		const doc = new InMemoryDocument(testFileName, '');
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual(await provider.lookup(''), undefined);
		assert.strictEqual(await provider.lookup('foo'), undefined);
	});

	test('Lookup should not return anything for document with no headers', async () => {
		const doc = new InMemoryDocument(testFileName, 'a *b*\nc');
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual(await provider.lookup(''), undefined);
		assert.strictEqual(await provider.lookup('foo'), undefined);
		assert.strictEqual(await provider.lookup('a'), undefined);
		assert.strictEqual(await provider.lookup('b'), undefined);
	});

	// -- Begin : changed for textile
	test('Lookup should return basic #header', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. a\n\nx\n\nh1. c`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		{
			const entry = await provider.lookup('a');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 0);
		}
		{
			assert.strictEqual(await provider.lookup('x'), undefined);
		}
		{
			const entry = await provider.lookup('c');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 4);
		}
	});

	test('Lookups should be case in-sensitive', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. fOo\n`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual((await provider.lookup('fOo'))!.line, 0);
		assert.strictEqual((await provider.lookup('foo'))!.line, 0);
		assert.strictEqual((await provider.lookup('FOO'))!.line, 0);
	});

	test('Lookups should ignore leading and trailing white-space, and collapse internal whitespace', async () => {
		const doc = new InMemoryDocument(testFileName, `h1.      f o  o    \n`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual((await provider.lookup('f o  o'))!.line, 0);
		assert.strictEqual((await provider.lookup('  f o  o'))!.line, 0);
		assert.strictEqual((await provider.lookup('  f o  o  '))!.line, 0);
		assert.strictEqual((await provider.lookup('f o o'))!.line, 0);
		assert.strictEqual((await provider.lookup('f o       o'))!.line, 0);

		assert.strictEqual(await provider.lookup('f'), undefined);
		assert.strictEqual(await provider.lookup('foo'), undefined);
		assert.strictEqual(await provider.lookup('fo o'), undefined);
	});

	test('should handle special characters #44779', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. Indentação\n`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual((await provider.lookup('indentação'))!.line, 0);
	});

	test('should handle special characters 2, #48482', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. Инструкция - Делай Раз, Делай Два\n`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual((await provider.lookup('инструкция---делай-раз-делай-два'))!.line, 0);
	});

	test('should handle special characters 3, #37079', async () => {
		const doc = new InMemoryDocument(testFileName, `h2. Header 2

h3. Header 3

h2. Заголовок 2

h3. Заголовок 3

h3. Заголовок Header 3

h2. Заголовок`);

		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		assert.strictEqual((await provider.lookup('header-2'))!.line, 0);
		assert.strictEqual((await provider.lookup('header-3'))!.line, 2);
		assert.strictEqual((await provider.lookup('Заголовок-2'))!.line, 4);
		assert.strictEqual((await provider.lookup('Заголовок-3'))!.line, 6);
		assert.strictEqual((await provider.lookup('Заголовок-header-3'))!.line, 8);
		assert.strictEqual((await provider.lookup('Заголовок'))!.line, 10);
	});

	test('Lookup should support suffixes for repeated headers', async () => {
		const doc = new InMemoryDocument(testFileName, `h1. a\n\nh1. a\n\nh2. a`);
		const provider = new TableOfContentsProvider(createNewTextileEngine(), doc);

		{
			const entry = await provider.lookup('a');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 0);
		}
		{
			const entry = await provider.lookup('a-1');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 2);
		}
		{
			const entry = await provider.lookup('a-2');
			assert.ok(entry);
			assert.strictEqual(entry!.line, 4);
		}
	});
	// -- End : changed for textile
});
