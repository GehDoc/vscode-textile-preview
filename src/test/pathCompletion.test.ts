/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLinkProvider } from '../languageFeatures/documentLinkProvider';
import { TextilePathCompletionProvider } from '../languageFeatures/pathCompletions';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { createNewTextileEngine } from './engine';
import { CURSOR, getCursorPositions, joinLines, workspacePath } from './util';


function getCompletionsAtCursor(resource: vscode.Uri, fileContents: string) {
	const doc = new InMemoryDocument(resource, fileContents);
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const provider = new TextilePathCompletionProvider(engine, linkProvider);
	const cursorPositions = getCursorPositions(fileContents, doc);
	return provider.provideCompletionItems(doc, cursorPositions[0], noopToken, {
		triggerCharacter: undefined,
		triggerKind: vscode.CompletionTriggerKind.Invoke,
	});
}

suite('Textile path completion provider', () => {

	// -- Begin : changed for textile
	setup(async () => {
		// These tests assume that the textile completion provider is already registered
		await vscode.extensions.getExtension('gehdoc.vscode-textile-preview')!.activate();
	});

	test('Should not return anything when triggered in empty doc', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), `${CURSOR}`);
		assert.strictEqual(completions.length, 0);
	});

	test('Should return anchor completions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":#${CURSOR}`,
			``,
			`h1. A b C`,
			``,
			`h1. x y Z`,
		));

		assert.strictEqual(completions.length, 2);
		assert.ok(completions.some(x => x.label === '#a-b-c'), 'Has a-b-c anchor completion');
		assert.ok(completions.some(x => x.label === '#x-y-z'), 'Has x-y-z anchor completion');
	});

	test('Should not return suggestions for http links', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":http:${CURSOR}`,
			``,
			`h1. http`,
			``,
			`h1. http:`,
			``,
			`h1. https:`,
		));

		assert.strictEqual(completions.length, 0);
	});

	test('Should return relative path suggestions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":${CURSOR}`,
			``,
			`h1. A b C`,
		));

		assert.ok(completions.some(x => x.label === 'a.textile'), 'Has a.textile file completion');
		assert.ok(completions.some(x => x.label === 'b.textile'), 'Has b.textile file completion');
		assert.ok(completions.some(x => x.label === 'sub/'), 'Has sub folder completion');
	});

	test('Should return relative path suggestions using ./', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./${CURSOR}`,
			``,
			`h1. A b C`,
		));

		assert.ok(completions.some(x => x.label === 'a.textile'), 'Has a.textile file completion');
		assert.ok(completions.some(x => x.label === 'b.textile'), 'Has b.textile file completion');
		assert.ok(completions.some(x => x.label === 'sub/'), 'Has sub folder completion');
	});

	test('Should return absolute path suggestions using /', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":/${CURSOR}`,
			``,
			`h1. A b C`,
		));

		assert.ok(completions.some(x => x.label === 'a.textile'), 'Has a.textile file completion');
		assert.ok(completions.some(x => x.label === 'b.textile'), 'Has b.textile file completion');
		assert.ok(completions.some(x => x.label === 'sub/'), 'Has sub folder completion');
		assert.ok(!completions.some(x => x.label === 'c.textile'), 'Should not have c.textile from sub folder');
	});

	test('Should return anchor suggestions in other file', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":/b.textile#${CURSOR}`,
		));

		assert.ok(completions.some(x => x.label === '#b'), 'Has #b header completion');
		assert.ok(completions.some(x => x.label === '#header1'), 'Has #header1 header completion');
	});

	test('Should reference links for current file', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":${CURSOR}`,
			``,
			`[ref-1]http://www.google.com`,
			`[ref-2]http://www.google.com`,
		));

		//assert.strictEqual(completions.length, 2);
		assert.ok(completions.some(x => x.label === 'ref-1'), 'Has ref-1 reference completion');
		assert.ok(completions.some(x => x.label === 'ref-2'), 'Has ref-2 reference completion');
	});

	test('Should complete headers in link definitions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`h1. a B c`,
			``,
			`h1. x y    Z`,
			``,
			`[ref-1]${CURSOR}`,
		));

		assert.ok(completions.some(x => x.label === '#a-b-c'), 'Has #a-b-c header completion');
		assert.ok(completions.some(x => x.label === '#x-y-z'), 'Has #x-y-z header completion');
	});

	test('Should complete relative paths in link definitions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`h1. a B c`,
			``,
			`[ref-1]${CURSOR}`,
		));

		assert.ok(completions.some(x => x.label === 'a.textile'), 'Has a.textile file completion');
		assert.ok(completions.some(x => x.label === 'b.textile'), 'Has b.textile file completion');
		assert.ok(completions.some(x => x.label === 'sub/'), 'Has sub folder completion');
	});

	test('Should escape spaces in path names', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./sub/${CURSOR}`
		));

		assert.ok(completions.some(x => x.insertText === 'file%20with%20space.textile'), 'Has encoded path completion');
	});

	test('Should complete paths for path with encoded spaces', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./sub%20with%20space/${CURSOR}`
		));

		assert.ok(completions.some(x => x.insertText === 'file.textile'), 'Has file from space');
	});

	test('Should complete definition path for path with encoded spaces', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`[def]./sub%20with%20space/${CURSOR}`
		));

		assert.ok(completions.some(x => x.insertText === 'file.textile'), 'Has file from space');
	});
	// -- End : changed for textile

	// -- Begin : added for textile
	test('Should return completions for image links also', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":${CURSOR}`,
			``,
			`h1. A b C`,
			``,
			`h1. x y Z`,
		));

		assert.strictEqual(completions.length, 6);
	});
	// -- End : added for textile
});
