/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { DiagnosticCollectionReporter, DiagnosticComputer, DiagnosticConfiguration, DiagnosticLevel, DiagnosticManager, DiagnosticOptions, DiagnosticReporter } from '../languageFeatures/diagnostics';
import { TextileLinkProvider } from '../languageFeatures/documentLinks';
import { TextileReferencesProvider } from '../languageFeatures/references';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { ITextDocument } from '../types/textDocument';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { InMemoryDocument } from '../util/inMemoryDocument';
import { ResourceMap } from '../util/resourceMap';
import { ITextileWorkspace } from '../workspace';
import { createNewTextileEngine } from './engine';
import { InMemoryMdWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { assertRangeEqual, joinLines, withStore, workspacePath } from './util';

const defaultDiagnosticsOptions = Object.freeze<DiagnosticOptions>({
	enabled: true,
	validateFileLinks: DiagnosticLevel.warning,
	validateTextileFileLinkFragments: undefined,
	validateFragmentLinks: DiagnosticLevel.warning,
	validateReferences: DiagnosticLevel.warning,
	ignoreLinks: [],
});

async function getComputedDiagnostics(store: DisposableStore, doc: InMemoryDocument, workspace: ITextileWorkspace, options: Partial<DiagnosticOptions> = {}): Promise<vscode.Diagnostic[]> {
	const engine = createNewTextileEngine();
	const linkProvider = store.add(new TextileLinkProvider(engine, workspace, nulLogger));
	const tocProvider = store.add(new TextileTableOfContentsProvider(engine, workspace, nulLogger));
	const computer = new DiagnosticComputer(workspace, linkProvider, tocProvider);
	return (
		await computer.getDiagnostics(doc, { ...defaultDiagnosticsOptions, ...options, }, noopToken)
	).diagnostics;
}

function assertDiagnosticsEqual(actual: readonly vscode.Diagnostic[], expectedRanges: readonly vscode.Range[]) {
	assert.strictEqual(actual.length, expectedRanges.length, "Diagnostic count equal");

	for (let i = 0; i < actual.length; ++i) {
		assertRangeEqual(actual[i].range, expectedRanges[i], `Range ${i} to be equal`);
	}
}

function orderDiagnosticsByRange(diagnostics: Iterable<vscode.Diagnostic>): readonly vscode.Diagnostic[] {
	return Array.from(diagnostics).sort((a, b) => a.range.start.compareTo(b.range.start));
}

class MemoryDiagnosticConfiguration implements DiagnosticConfiguration {

	private readonly _onDidChange = new vscode.EventEmitter<void>();
	public readonly onDidChange = this._onDidChange.event;

	private _options: Partial<DiagnosticOptions>;

	constructor(options: Partial<DiagnosticOptions>) {
		this._options = options;
	}

	public getOptions(_resource: vscode.Uri): DiagnosticOptions {
		return {
			...defaultDiagnosticsOptions,
			...this._options,
		};
	}

	public update(newOptions: Partial<DiagnosticOptions>) {
		this._options = newOptions;
		this._onDidChange.fire();
	}
}

class MemoryDiagnosticReporter extends DiagnosticReporter {

	private readonly diagnostics = new ResourceMap<readonly vscode.Diagnostic[]>();

	constructor(
		private readonly workspace: InMemoryMdWorkspace,
	) {
		super();
	}

	override dispose(): void {
		super.clear();
		this.clear();
	}

	override clear(): void {
		super.clear();
		this.diagnostics.clear();
	}

	set(uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[]): void {
		this.diagnostics.set(uri, diagnostics);
	}

	isOpen(_uri: vscode.Uri): boolean {
		return true;
	}

	delete(uri: vscode.Uri): void {
		this.diagnostics.delete(uri);
	}

	get(uri: vscode.Uri): readonly vscode.Diagnostic[] {
		return orderDiagnosticsByRange(this.diagnostics.get(uri) ?? []);
	}

	getOpenDocuments(): ITextDocument[] {
		return this.workspace.values();
	}
}

suite('textile: Diagnostic Computer', () => {

	test('Should not return any diagnostics for empty document', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.textile'), joinLines(
			`text`,
		));
		const workspace = store.add(new InMemoryMdWorkspace([doc]));

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
