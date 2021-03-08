/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { joinLines } from './util';

// -- Begin: Modified for textile
const testFileA = workspaceFile('a.textile');

function workspaceFile(...segments: string[]) {
	return vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, ...segments);
}

async function getLinksForFile(file: vscode.Uri): Promise<vscode.DocumentLink[]> {
	return (await vscode.commands.executeCommand<vscode.DocumentLink[]>('vscode.executeLinkProvider', file))!;
}

suite('Textile Document links', () => {

	setup(async () => {
		// the tests make the assumption that link providers are already registered
		await vscode.extensions.getExtension('gehdoc.vscode-textile-preview')!.activate();
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('Should navigate to textile file', async () => {
		await withFileContents(testFileA, '"b":b.textile');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('b.textile'));
	});

	test('Should navigate to textile file with leading ./', async () => {
		await withFileContents(testFileA, '"b":./b.textile');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('b.textile'));
	});

	test('Should navigate to textile file with leading /', async () => {
		await withFileContents(testFileA, '"b":./b.textile');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('b.textile'));
	});

	test('Should navigate to textile file without file extension', async () => {
		await withFileContents(testFileA, '"b":b');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('b.textile'));
	});

	test('Should navigate to textile file in directory', async () => {
		await withFileContents(testFileA, '"b":sub/c');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('sub', 'c.textile'));
	});

	test('Should navigate to fragment by title in file', async () => {
		await withFileContents(testFileA, '"b":sub/c#second');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('sub', 'c.textile'));
		assert.strictEqual(vscode.window.activeTextEditor!.selection.start.line, 2);
	});

	test('Should navigate to fragment by line', async () => {
		await withFileContents(testFileA, '"b":sub/c#L2');

		const [link] = await getLinksForFile(testFileA);
		await executeLink(link);

		assertActiveDocumentUri(workspaceFile('sub', 'c.textile'));
		assert.strictEqual(vscode.window.activeTextEditor!.selection.start.line, 1);
	});

	test('Should navigate to fragment within current file', async () => {
		await withFileContents(testFileA, joinLines(
			'"current":a#header',
			'"current":#header',
			'',
			'h1. Header'));

		const links = await getLinksForFile(testFileA);
		{
			await executeLink(links[0]);
			assertActiveDocumentUri(workspaceFile('a.textile'));
			assert.strictEqual(vscode.window.activeTextEditor!.selection.start.line, 3);
		}
		{
			await executeLink(links[1]);
			assertActiveDocumentUri(workspaceFile('a.textile'));
			assert.strictEqual(vscode.window.activeTextEditor!.selection.start.line, 3);
		}
	});

	test('Should navigate to fragment within current untitled file', async () => {
		const testFile = workspaceFile('x.textile').with({ scheme: 'untitled' });
		await withFileContents(testFile, joinLines(
			'"current":#second',
			'',
			'h1. Second'));

		const [link] = await getLinksForFile(testFile);
		await executeLink(link);

		assertActiveDocumentUri(testFile);
		assert.strictEqual(vscode.window.activeTextEditor!.selection.start.line, 2);
	});
});
// -- End: Modified for textile


function assertActiveDocumentUri(expectedUri: vscode.Uri) {
	assert.strictEqual(
		vscode.window.activeTextEditor!.document.uri.fsPath,
		expectedUri.fsPath
	);
}

async function withFileContents(file: vscode.Uri, contents: string): Promise<void> {
	const document = await vscode.workspace.openTextDocument(file);
	const editor = await vscode.window.showTextDocument(document);
	await editor.edit(edit => {
		edit.replace(new vscode.Range(0, 0, 1000, 0), contents);
	});
}

async function executeLink(link: vscode.DocumentLink) {
	const args = JSON.parse(decodeURIComponent(link.target!.query));
	await vscode.commands.executeCommand(link.target!.path, args);
}

