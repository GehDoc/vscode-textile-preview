/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { DiagnosticComputer, DiagnosticConfiguration, DiagnosticLevel, DiagnosticManager, DiagnosticOptions } from '../languageFeatures/diagnostics';
import { TextileLinkProvider } from '../languageFeatures/documentLinkProvider';
import { noopToken } from '../util/cancellation';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { TextileWorkspaceContents } from '../workspaceContents';
import { createNewTextileEngine } from './engine';
import { InMemoryWorkspaceTextileDocuments } from './inMemoryWorkspace';
import { assertRangeEqual, joinLines, workspacePath } from './util';


async function getComputedDiagnostics(doc: InMemoryDocument, workspaceContents: TextileWorkspaceContents): Promise<vscode.Diagnostic[]> {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	const computer = new DiagnosticComputer(engine, workspaceContents, linkProvider);
	return (
		await computer.getDiagnostics(doc, {
			enabled: true,
			validateFilePaths: DiagnosticLevel.warning,
			validateOwnHeaders: DiagnosticLevel.warning,
			validateReferences: DiagnosticLevel.warning,
			ignoreLinks: [],
		}, noopToken)
	).diagnostics;
}

function createDiagnosticsManager(workspaceContents: TextileWorkspaceContents, configuration = new MemoryDiagnosticConfiguration()) {
	const engine = createNewTextileEngine();
	const linkProvider = new TextileLinkProvider(engine);
	return new DiagnosticManager(new DiagnosticComputer(engine, workspaceContents, linkProvider), configuration);
}

class MemoryDiagnosticConfiguration implements DiagnosticConfiguration {

	private readonly _onDidChange = new vscode.EventEmitter<void>();
	public readonly onDidChange = this._onDidChange.event;

	constructor(
		private readonly enabled: boolean = true,
		private readonly ignoreLinks: string[] = [],
	) { }

	getOptions(_resource: vscode.Uri): DiagnosticOptions {
		if (!this.enabled) {
			return {
				enabled: false,
				validateFilePaths: DiagnosticLevel.ignore,
				validateOwnHeaders: DiagnosticLevel.ignore,
				validateReferences: DiagnosticLevel.ignore,
				ignoreLinks: this.ignoreLinks,
			};
		}
		return {
			enabled: true,
			validateFilePaths: DiagnosticLevel.warning,
			validateOwnHeaders: DiagnosticLevel.warning,
			validateReferences: DiagnosticLevel.warning,
			ignoreLinks: this.ignoreLinks,
		};
	}
}


suite('textile: Diagnostics', () => {
	test('Should not return any diagnostics for empty document', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`text`,
		));

		const diagnostics = await getComputedDiagnostics(doc, new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(diagnostics, []);
	});

	test('Should generate diagnostic for link to file that does not exist', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`"bad":/no/such/file.textile`,
			`"good":/doc.textile`,
			`[good-ref]/doc.textile`,
			`[bad-ref]/no/such/file.textile`,
		));

		const diagnostics = await getComputedDiagnostics(doc, new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(diagnostics.length, 2);
		assertRangeEqual(new vscode.Range(0, 6, 0, 27), diagnostics[0].range);
		assertRangeEqual(new vscode.Range(3, 9, 3, 30), diagnostics[1].range);
	});

	test('Should generate diagnostics for links to header that does not exist in current file', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`"good":#good-header`,
			``,
			`h1. Good Header`,
			``,
			`"bad":#no-such-header`,
			`"good":#good-header`,
			`[good-ref]#good-header`,
			`[bad-ref]#no-such-header`,
		));

		const diagnostics = await getComputedDiagnostics(doc, new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(diagnostics.length, 2);
		assertRangeEqual(new vscode.Range(4, 6, 4, 21), diagnostics[0].range);
		assertRangeEqual(new vscode.Range(7, 9, 7, 24), diagnostics[1].range);
	});

	test('Should generate diagnostics for links to non-existent headers in other files', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`h1. My header`,
			``,
			`"good":#my-header`,
			`"good":/doc1.textile#my-header`,
			`"good":doc1.textile#my-header`,
			`"good":/doc2.textile#other-header"`,
			`"bad":/doc2.textile#no-such-other-header`,
		));

		const doc2 = new InMemoryDocument(workspacePath('doc2.textile'), joinLines(
			`h1. Other header`,
		));

		const diagnostics = await getComputedDiagnostics(doc1, new InMemoryWorkspaceTextileDocuments([doc1, doc2]));
		assert.deepStrictEqual(diagnostics.length, 1);
		assertRangeEqual(new vscode.Range(6, 6, 6, 40), diagnostics[0].range);
	});

	test('Should support links both with and without .textile file extension', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`h1. My header`,
			``,
			`[good]#my-header`,
			`[good]/doc.textile#my-header`,
			`[good]doc.textile#my-header`,
			`[good]/doc#my-header`,
			`[good]doc#my-header`,
		));

		const diagnostics = await getComputedDiagnostics(doc, new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('Should generate diagnostics for non-existent link reference', async () => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`"good link":good`,
			`"bad link":no-such`,
			``,
			`[good]http://example.com`,
		));

		const diagnostics = await getComputedDiagnostics(doc, new InMemoryWorkspaceTextileDocuments([doc]));
		assert.deepStrictEqual(diagnostics.length, 1);
		assertRangeEqual(new vscode.Range(1, 11, 1, 18), diagnostics[0].range);
	});

	test('Should not generate diagnostics when validate is disabled', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`[text]#no-such-header`,
			`[text]no-such-ref`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(false));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	/* Disabled : not relevant for Textile
	test('Should not generate diagnostics for email autolink', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.md'), joinLines(
			`a <user@example.com> c`,
		));

		const diagnostics = await getComputedDiagnostics(doc1, new InMemoryWorkspaceTextileDocuments([doc1]));
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('Should not generate diagnostics for html tag that looks like an autolink', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.md'), joinLines(
			`a <tag>b</tag> c`,
			`a <scope:tag>b</scope:tag> c`,
		));

		const diagnostics = await getComputedDiagnostics(doc1, new InMemoryWorkspaceTextileDocuments([doc1]));
		assert.deepStrictEqual(diagnostics.length, 0);
	});
	*/

	test('Should allow ignoring invalid file link using glob', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`"text":/no-such-file`,
			`!/no-such-file(img)!`,
			`[text]/no-such-file`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(true, ['/no-such-file']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('ignoreLinks should allow skipping link to non-existent file', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`"text":/no-such-file#header`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(true, ['/no-such-file']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('ignoreLinks should not consider link fragment', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`"text":/no-such-file#header`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(true, ['/no-such-file']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('ignoreLinks should support globs', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`!/images/aaa.png(i)!`,
			`!/images/sub/bbb.png(i)!`,
			`!/images/sub/sub2/ccc.png(i)!`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(true, ['/images/**/*.png']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('ignoreLinks should support ignoring header', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`!#no-such(i)!`,
		));

		const manager = createDiagnosticsManager(new InMemoryWorkspaceTextileDocuments([doc1]), new MemoryDiagnosticConfiguration(true, ['#no-such']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	test('ignoreLinks should support ignoring header in file', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`!/doc2.textile#no-such(i)!`,
		));
		const doc2 = new InMemoryDocument(workspacePath('doc2.textile'), joinLines(''));

		const contents = new InMemoryWorkspaceTextileDocuments([doc1, doc2]);
		{
			const manager = createDiagnosticsManager(contents, new MemoryDiagnosticConfiguration(true, ['/doc2.textile#no-such']));
			const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
			assert.deepStrictEqual(diagnostics.length, 0);
		}
		{
			const manager = createDiagnosticsManager(contents, new MemoryDiagnosticConfiguration(true, ['/doc2.textile#*']));
			const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
			assert.deepStrictEqual(diagnostics.length, 0);
		}
	});

	test('ignoreLinks should support ignore header links if file is ignored', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.textile'), joinLines(
			`!/doc2.textile#no-such(i)!`,
		));
		const doc2 = new InMemoryDocument(workspacePath('doc2.textile'), joinLines(''));

		const contents = new InMemoryWorkspaceTextileDocuments([doc1, doc2]);
		const manager = createDiagnosticsManager(contents, new MemoryDiagnosticConfiguration(true, ['/doc2.textile']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});

	/* Disabled : not relevant for Textile
	test('Should not detect checkboxes as invalid links', async () => {
		const doc1 = new InMemoryDocument(workspacePath('doc1.md'), joinLines(
			`- [x]`,
			`- [X]`,
			`- [ ]`,
		));

		const contents = new InMemoryWorkspaceTextileDocuments([doc1]);
		const manager = createDiagnosticsManager(contents, new MemoryDiagnosticConfiguration(true, ['/doc2.md']));
		const { diagnostics } = await manager.recomputeDiagnosticState(doc1, noopToken);
		assert.deepStrictEqual(diagnostics.length, 0);
	});
	*/
});
