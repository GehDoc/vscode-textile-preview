/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { TextileLinkProvider } from '../languageFeatures/documentLinks';
import { TextileVsCodePathCompletionProvider } from '../languageFeatures/pathCompletions';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryTextileWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { CURSOR, getCursorPositions, joinLines, workspacePath } from './util';


async function getCompletionsAtCursor(resource: vscode.Uri, fileContents: string, workspace?: ITextileWorkspace) {
	const doc = new InMemoryDocument(resource, fileContents);

	const engine = createNewTextileEngine();
	const ws = workspace ?? new InMemoryTextileWorkspace([doc]);
	const linkProvider = new TextileLinkProvider(engine, ws, nulLogger);
	const provider = new TextileVsCodePathCompletionProvider(ws, engine, linkProvider);
	const cursorPositions = getCursorPositions(fileContents, doc);
	const completions = await provider.provideCompletionItems(doc, cursorPositions[0], noopToken, {
		triggerCharacter: undefined,
		triggerKind: vscode.CompletionTriggerKind.Invoke,
	});

	return completions.sort((a, b) => (a.label as string).localeCompare(b.label as string));
}

function assertCompletionsEqual(actual: readonly vscode.CompletionItem[], expected: readonly { label: string; insertText?: string }[]) {
	assert.strictEqual(actual.length, expected.length, 'Completion counts should be equal');

	for (let i = 0; i < actual.length; ++i) {
		assert.strictEqual(actual[i].label, expected[i].label, `Completion labels ${i} should be equal`);
		if (typeof expected[i].insertText !== 'undefined') {
			assert.strictEqual(actual[i].insertText, expected[i].insertText, `Completion insert texts ${i} should be equal`);
		}
	}
}

suite('Textile: Path completions', () => {

	// -- Begin : changed for textile
	test('Should not return anything when triggered in empty doc', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), `${CURSOR}`);
		assertCompletionsEqual(completions, []);
	});

	test('Should return anchor completions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":#${CURSOR}`,
			``,
			`h1. A b C`,
			``,
			`h1. x y Z`,
		));

		assertCompletionsEqual(completions, [
			{ label: '#a-b-c' },
			{ label: '#x-y-z' },
		]);
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

		assertCompletionsEqual(completions, []);
	});

	test('Should return relative path suggestions', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub/foo.textile'), ''),
		]);
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":${CURSOR}`,
			``,
			`h1. A b C`,
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: '#a-b-c' },
			{ label: 'a.textile' },
			{ label: 'b.textile' },
			{ label: 'sub/' },
		]);
	});

	test('Should return relative path suggestions using ./', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub/foo.textile'), ''),
		]);
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./${CURSOR}`,
			``,
			`h1. A b C`,
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'a.textile' },
			{ label: 'b.textile' },
			{ label: 'sub/' },
		]);
	});

	test('Should return absolute path suggestions using /', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub/c.textile'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":/${CURSOR}`,
			``,
			`h1. A b C`,
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'a.textile' },
			{ label: 'b.textile' },
			{ label: 'sub/' },
		]);
	});

	test('Should return anchor suggestions in other file', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('b.textile'), joinLines(
				`h1. b`,
				``,
				`"./a":./a`,
				``,
				`h1. header1`,
			)),
		]);
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":/b.textile#${CURSOR}`,
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: '#b' },
			{ label: '#header1' },
		]);
	});

	test('Should reference links for current file', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`"":${CURSOR}`,
			``,
			`[ref-1]http://www.google.com`,
			`[ref-2]http://www.google.com`,
		));

		assertCompletionsEqual(completions, [
			{ label: 'new.textile' }, // Added for Textile
			{ label: 'ref-1' },
			{ label: 'ref-2' },
		]);
	});

	test('Should complete headers in link definitions', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('sub', 'new.textile'), joinLines(
			`h1. a B c`,
			``,
			`h1. x y    Z`,
			``,
			`[ref-1]${CURSOR}`,
		));

		assertCompletionsEqual(completions, [
			{ label: '#a-b-c' },
			{ label: '#x-y-z' },
			{ label: 'new.textile' },
		]);
	});

	test('Should complete relative paths in link definitions', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub/c.textile'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`h1. a B c`,
			``,
			`[ref-1]${CURSOR}`,
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: '#a-b-c' },
			{ label: 'a.textile' },
			{ label: 'b.textile' },
			{ label: 'sub/' },
		]);
	});

	test('Should escape spaces in path names', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub/file with space.textile'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./sub/${CURSOR}`
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'file with space.textile', insertText: 'file%20with%20space.textile' },
		]);
	});

	/* Disabled for Textile : not relevant
	test('Should support completions on angle bracket path with spaces', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('sub with space/a.md'), ''),
			new InMemoryDocument(workspacePath('b.md'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('new.md'), joinLines(
			`[](</sub with space/${CURSOR}`
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'a.md', insertText: 'a.md' },
		]);
	});

	test('Should not escape spaces in path names that use angle brackets', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('sub/file with space.md'), ''),
		]);

		{
			const completions = await getCompletionsAtCursor(workspacePath('new.md'), joinLines(
				`[](<./sub/${CURSOR}`
			), workspace);

			assertCompletionsEqual(completions, [
				{ label: 'file with space.md', insertText: 'file with space.md' },
			]);
		}
		{
			const completions = await getCompletionsAtCursor(workspacePath('new.md'), joinLines(
				`[](<./sub/${CURSOR}>`
			), workspace);

			assertCompletionsEqual(completions, [
				{ label: 'file with space.md', insertText: 'file with space.md' },
			]);
		}
	});
	*/

	test('Should complete paths for path with encoded spaces', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub with space/file.textile'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`"":./sub%20with%20space/${CURSOR}`
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'file.textile', insertText: 'file.textile' },
		]);
	});

	test('Should complete definition path for path with encoded spaces', async () => {
		const workspace = new InMemoryTextileWorkspace([
			new InMemoryDocument(workspacePath('a.textile'), ''),
			new InMemoryDocument(workspacePath('b.textile'), ''),
			new InMemoryDocument(workspacePath('sub with space/file.textile'), ''),
		]);

		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`[def]./sub%20with%20space/${CURSOR}`
		), workspace);

		assertCompletionsEqual(completions, [
			{ label: 'def' }, // FIXME : should be filtered by the path
			{ label: 'file.textile', insertText: 'file.textile' },
		]);
	});
	// -- End : changed for textile

	// -- Begin : added for textile
	test('Should complete paths for image links', async () => {
		const completions = await getCompletionsAtCursor(workspacePath('new.textile'), joinLines(
			`!!:${CURSOR}`,
			``,
			`h1. A b C`,
			``,
			`h1. x y Z`,
		));

		assertCompletionsEqual(completions, [
			{ label: '#a-b-c' },
			{ label: '#x-y-z' },
			{ label: 'new.textile' },
		]);
	});
	// -- End : added for textile
});
