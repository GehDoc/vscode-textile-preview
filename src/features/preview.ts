/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { OpenDocumentLinkCommand, resolveLinkToTextileFile } from '../commands/openDocumentLink';
import { Logger } from '../logger';
import { TextileContributionProvider } from '../textileExtensions';
import { Disposable } from '../util/dispose';
import { isTextileFile } from '../util/file';
import { normalizeResource, WebviewResourceProvider } from '../util/resources';
import { getVisibleLine, TopmostLineMonitor } from '../util/topmostLineMonitor';
import { TextilePreviewConfigurationManager } from './previewConfig';
import { TextileContentProvider } from './previewContentProvider';
import { TextileEngine } from '../textileEngine';

const localize = nls.loadMessageBundle();

interface WebviewMessage {
	readonly source: string;
}

interface CacheImageSizesMessage extends WebviewMessage {
	readonly type: 'cacheImageSizes';
	readonly body: { id: string, width: number, height: number; }[];
}

interface RevealLineMessage extends WebviewMessage {
	readonly type: 'revealLine';
	readonly body: {
		readonly line: number;
	};
}

interface DidClickMessage extends WebviewMessage {
	readonly type: 'didClick';
	readonly body: {
		readonly line: number;
	};
}

interface ClickLinkMessage extends WebviewMessage {
	readonly type: 'openLink';
	readonly body: {
		readonly href: string;
	};
}

interface ShowPreviewSecuritySelectorMessage extends WebviewMessage {
	readonly type: 'showPreviewSecuritySelector';
}

interface PreviewStyleLoadErrorMessage extends WebviewMessage {
	readonly type: 'previewStyleLoadError';
	readonly body: {
		readonly unloadedStyles: string[];
	};
}

export class PreviewDocumentVersion {

	private readonly resource: vscode.Uri;
	private readonly version: number;

	public constructor(document: vscode.TextDocument) {
		this.resource = document.uri;
		this.version = document.version;
	}

	public equals(other: PreviewDocumentVersion): boolean {
		return this.resource.fsPath === other.resource.fsPath
			&& this.version === other.version;
	}
}

interface TextilePreviewDelegate {
	getTitle?(resource: vscode.Uri): string;
	getAdditionalState(): {},
	openPreviewLinkToTextileFile(textileLink: vscode.Uri, fragment: string): void;
}

class StartingScrollLine {
	public readonly type = 'line';

	constructor(
		public readonly line: number,
	) { }
}

class StartingScrollFragment {
	public readonly type = 'fragment';

	constructor(
		public readonly fragment: string,
	) { }
}

type StartingScrollLocation = StartingScrollLine | StartingScrollFragment;

class TextilePreview extends Disposable implements WebviewResourceProvider {

	private readonly delay = 300;

	private readonly _resource: vscode.Uri;
	private readonly _webviewPanel: vscode.WebviewPanel;

	private throttleTimer: any;

	private line: number | undefined;
	private scrollToFragment: string | undefined;

	private firstUpdate = true;
	private currentVersion?: PreviewDocumentVersion;
	private isScrolling = false;
	private _disposed: boolean = false;
	private imageInfo: { readonly id: string, readonly width: number, readonly height: number; }[] = [];

	constructor(
		webview: vscode.WebviewPanel,
		resource: vscode.Uri,
		startingScroll: StartingScrollLocation | undefined,
		private readonly delegate: TextilePreviewDelegate,
		private readonly engine: TextileEngine,
		private readonly _contentProvider: TextileContentProvider,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		private readonly _logger: Logger,
		private readonly _contributionProvider: TextileContributionProvider,
	) {
		super();

		this._webviewPanel = webview;
		this._resource = resource;

		switch (startingScroll?.type) {
			case 'line':
				if (!isNaN(startingScroll.line!)) {
					this.line = startingScroll.line;
				}
				break;

			case 'fragment':
				this.scrollToFragment = startingScroll.fragment;
				break;
		}

		this._register(_contributionProvider.onContributionsChanged(() => {
			setImmediate(() => this.refresh());
		}));

		this._register(vscode.workspace.onDidChangeTextDocument(event => {
			if (this.isPreviewOf(event.document.uri)) {
				this.refresh();
			}
		}));

		this._register(this._webviewPanel.webview.onDidReceiveMessage((e: CacheImageSizesMessage | RevealLineMessage | DidClickMessage | ClickLinkMessage | ShowPreviewSecuritySelectorMessage | PreviewStyleLoadErrorMessage) => {
			if (e.source !== this._resource.toString()) {
				return;
			}

			switch (e.type) {
				case 'cacheImageSizes':
					this.imageInfo = e.body;
					break;

				case 'revealLine':
					this.onDidScrollPreview(e.body.line);
					break;

				case 'didClick':
					this.onDidClickPreview(e.body.line);
					break;

				case 'openLink':
					this.onDidClickPreviewLink(e.body.href);
					break;

				case 'showPreviewSecuritySelector':
					vscode.commands.executeCommand('textile.showPreviewSecuritySelector', e.source);
					break;

				case 'previewStyleLoadError':
					vscode.window.showWarningMessage(
						localize('onPreviewStyleLoadError',
							"Could not load 'textile.styles': {0}",
							e.body.unloadedStyles.join(', ')));
					break;
			}
		}));

		this.updatePreview();
	}

	dispose() {
		super.dispose();
		this._disposed = true;
		clearTimeout(this.throttleTimer);
	}

	public get resource(): vscode.Uri {
		return this._resource;
	}

	public get state() {
		return {
			resource: this._resource.toString(),
			line: this.line,
			imageInfo: this.imageInfo,
			fragment: this.scrollToFragment,
			...this.delegate.getAdditionalState(),
		};
	}

	public refresh() {
		// Schedule update if none is pending
		if (!this.throttleTimer) {
			if (this.firstUpdate) {
				this.updatePreview(true);
			} else {
				this.throttleTimer = setTimeout(() => this.updatePreview(true), this.delay);
			}
		}

		this.firstUpdate = false;
	}

	private get iconPath() {
		const root = vscode.Uri.joinPath(this._contributionProvider.extensionUri, 'media');
		return {
			light: vscode.Uri.joinPath(root, 'preview-light.svg'),
			dark: vscode.Uri.joinPath(root, 'preview-dark.svg'),
		};
	}

	public isPreviewOf(resource: vscode.Uri): boolean {
		return this._resource.fsPath === resource.fsPath;
	}

	public postMessage(msg: any) {
		if (!this._disposed) {
			this._webviewPanel.webview.postMessage(msg);
		}
	}

	public scrollTo(topLine: number) {
		if (this._disposed) {
			return;
		}

		if (this.isScrolling) {
			this.isScrolling = false;
			return;
		}

		this._logger.log('updateForView', { textileFile: this._resource });
		this.line = topLine;
		this.postMessage({
			type: 'updateView',
			line: topLine,
			source: this._resource.toString()
		});
	}

	private async updatePreview(forceUpdate?: boolean): Promise<void> {
		clearTimeout(this.throttleTimer);
		this.throttleTimer = undefined;

		if (this._disposed) {
			return;
		}

		let document: vscode.TextDocument;
		try {
			document = await vscode.workspace.openTextDocument(this._resource);
		} catch {
			await this.showFileNotFoundError();
			return;
		}

		if (this._disposed) {
			return;
		}

		const pendingVersion = new PreviewDocumentVersion(document);
		if (!forceUpdate && this.currentVersion?.equals(pendingVersion)) {
			if (this.line) {
				this.scrollTo(this.line);
			}
			return;
		}

		this.currentVersion = pendingVersion;
		const content = await this._contentProvider.provideTextDocumentContent(document, this, this._previewConfigurations, this.line, this.state);

		// Another call to `doUpdate` may have happened.
		// Make sure we are still updating for the correct document
		if (this.currentVersion?.equals(pendingVersion)) {
			this.setContent(content);
		}
	}

	private onDidScrollPreview(line: number) {
		this.line = line;

		const config = this._previewConfigurations.loadAndCacheConfiguration(this._resource);
		if (!config.scrollEditorWithPreview) {
			return;
		}

		for (const editor of vscode.window.visibleTextEditors) {
			if (!this.isPreviewOf(editor.document.uri)) {
				continue;
			}

			this.isScrolling = true;
			const sourceLine = Math.floor(line);
			const fraction = line - sourceLine;
			const text = editor.document.lineAt(sourceLine).text;
			const start = Math.floor(fraction * text.length);
			editor.revealRange(
				new vscode.Range(sourceLine, start, sourceLine + 1, 0),
				vscode.TextEditorRevealType.AtTop);
		}
	}

	private async onDidClickPreview(line: number): Promise<void> {
		// fix #82457, find currently opened but unfocused source tab
		await vscode.commands.executeCommand('textile.showSource');

		for (const visibleEditor of vscode.window.visibleTextEditors) {
			if (this.isPreviewOf(visibleEditor.document.uri)) {
				const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
				const position = new vscode.Position(line, 0);
				editor.selection = new vscode.Selection(position, position);
				return;
			}
		}

		vscode.workspace.openTextDocument(this._resource)
			.then(vscode.window.showTextDocument)
			.then(undefined, () => {
				vscode.window.showErrorMessage(localize('preview.clickOpenFailed', 'Could not open {0}', this._resource.toString()));
			});
	}

	private async showFileNotFoundError() {
		this._webviewPanel.webview.html = this._contentProvider.provideFileNotFoundContent(this._resource);
	}

	private setContent(html: string): void {
		if (this._disposed) {
			return;
		}

		if (this.delegate.getTitle) {
			this._webviewPanel.title = this.delegate.getTitle(this._resource);
		}
		this._webviewPanel.iconPath = this.iconPath;
		this._webviewPanel.webview.options = this.getWebviewOptions();

		this._webviewPanel.webview.html = html;
	}

	private getWebviewOptions(): vscode.WebviewOptions {
		return {
			enableScripts: true,
			localResourceRoots: this.getLocalResourceRoots()
		};
	}

	private getLocalResourceRoots(): ReadonlyArray<vscode.Uri> {
		const baseRoots = Array.from(this._contributionProvider.contributions.previewResourceRoots);

		const folder = vscode.workspace.getWorkspaceFolder(this._resource);
		if (folder) {
			const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri);
			if (workspaceRoots) {
				baseRoots.push(...workspaceRoots);
			}
		} else if (!this._resource.scheme || this._resource.scheme === 'file') {
			baseRoots.push(vscode.Uri.file(path.dirname(this._resource.fsPath)));
		}

		return baseRoots.map(root => normalizeResource(this._resource, root));
	}


	private async onDidClickPreviewLink(href: string) {
		let [hrefPath, fragment] = decodeURIComponent(href).split('#');

		// We perviously already resolve absolute paths.
		// Now make sure we handle relative file paths
		if (hrefPath[0] !== '/') {
			// Fix #93691, use this.resource.fsPath instead of this.resource.path
			hrefPath = path.join(path.dirname(this.resource.fsPath), hrefPath);
		}

		const config = vscode.workspace.getConfiguration('textile', this.resource);
		const openLinks = config.get<string>('preview.openTextileLinks', 'inPreview');
		if (openLinks === 'inPreview') {
			const textileLink = await resolveLinkToTextileFile(hrefPath);
			if (textileLink) {
				this.delegate.openPreviewLinkToTextileFile(textileLink, fragment);
				return;
			}
		}

		OpenDocumentLinkCommand.execute(this.engine, { path: hrefPath, fragment, fromResource: this.resource.toJSON() });
	}

	//#region WebviewResourceProvider

	asWebviewUri(resource: vscode.Uri) {
		return this._webviewPanel.webview.asWebviewUri(normalizeResource(this._resource, resource));
	}

	get cspSource() {
		return this._webviewPanel.webview.cspSource;
	}

	//#endregion
}

export interface ManagedTextilePreview {

	readonly resource: vscode.Uri;
	readonly resourceColumn: vscode.ViewColumn;

	readonly onDispose: vscode.Event<void>;
	readonly onDidChangeViewState: vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent>;

	dispose(): void;

	refresh(): void;
	updateConfiguration(): void;

	matchesResource(
		otherResource: vscode.Uri,
		otherPosition: vscode.ViewColumn | undefined,
		otherLocked: boolean
	): boolean;
}

export class StaticTextilePreview extends Disposable implements ManagedTextilePreview {

	public static revive(
		resource: vscode.Uri,
		webview: vscode.WebviewPanel,
		contentProvider: TextileContentProvider,
		previewConfigurations: TextilePreviewConfigurationManager,
		logger: Logger,
		contributionProvider: TextileContributionProvider,
		engine: TextileEngine,
	): StaticTextilePreview {
		return new StaticTextilePreview(webview, resource, contentProvider, previewConfigurations, logger, contributionProvider, engine);
	}

	private readonly preview: TextilePreview;

	private constructor(
		private readonly _webviewPanel: vscode.WebviewPanel,
		resource: vscode.Uri,
		contentProvider: TextileContentProvider,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		logger: Logger,
		contributionProvider: TextileContributionProvider,
		engine: TextileEngine,
	) {
		super();

		this.preview = this._register(new TextilePreview(this._webviewPanel, resource, undefined, {
			getAdditionalState: () => { return {}; },
			openPreviewLinkToTextileFile: () => { /* todo */ }
		}, engine, contentProvider, _previewConfigurations, logger, contributionProvider));

		this._register(this._webviewPanel.onDidDispose(() => {
			this.dispose();
		}));

		this._register(this._webviewPanel.onDidChangeViewState(e => {
			this._onDidChangeViewState.fire(e);
		}));
	}

	private readonly _onDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDispose = this._onDispose.event;

	private readonly _onDidChangeViewState = this._register(new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>());
	public readonly onDidChangeViewState = this._onDidChangeViewState.event;

	dispose() {
		this._onDispose.fire();
		super.dispose();
	}

	public matchesResource(
		_otherResource: vscode.Uri,
		_otherPosition: vscode.ViewColumn | undefined,
		_otherLocked: boolean
	): boolean {
		return false;
	}

	public refresh() {
		this.preview.refresh();
	}

	public updateConfiguration() {
		if (this._previewConfigurations.hasConfigurationChanged(this.preview.resource)) {
			this.refresh();
		}
	}

	public get resource() {
		return this.preview.resource;
	}

	public get resourceColumn() {
		return this._webviewPanel.viewColumn || vscode.ViewColumn.One;
	}
}

interface DynamicPreviewInput {
	readonly resource: vscode.Uri;
	readonly resourceColumn: vscode.ViewColumn;
	readonly locked: boolean;
	readonly line?: number;
}

/**
 * A
 */
export class DynamicTextilePreview extends Disposable implements ManagedTextilePreview {

	public static readonly viewType = 'textile.preview';

	private readonly _resourceColumn: vscode.ViewColumn;
	private _locked: boolean;

	private readonly _webviewPanel: vscode.WebviewPanel;
	private _preview: TextilePreview;

	public static revive(
		input: DynamicPreviewInput,
		webview: vscode.WebviewPanel,
		contentProvider: TextileContentProvider,
		previewConfigurations: TextilePreviewConfigurationManager,
		logger: Logger,
		topmostLineMonitor: TopmostLineMonitor,
		contributionProvider: TextileContributionProvider,
		engine: TextileEngine,
	): DynamicTextilePreview {
		return new DynamicTextilePreview(webview, input,
			contentProvider, previewConfigurations, logger, topmostLineMonitor, contributionProvider, engine);
	}

	public static create(
		input: DynamicPreviewInput,
		previewColumn: vscode.ViewColumn,
		contentProvider: TextileContentProvider,
		previewConfigurations: TextilePreviewConfigurationManager,
		logger: Logger,
		topmostLineMonitor: TopmostLineMonitor,
		contributionProvider: TextileContributionProvider,
		engine: TextileEngine,
	): DynamicTextilePreview {
		const webview = vscode.window.createWebviewPanel(
			DynamicTextilePreview.viewType,
			DynamicTextilePreview.getPreviewTitle(input.resource, input.locked),
			previewColumn, { enableFindWidget: true, });

		return new DynamicTextilePreview(webview, input,
			contentProvider, previewConfigurations, logger, topmostLineMonitor, contributionProvider, engine);
	}

	private constructor(
		webview: vscode.WebviewPanel,
		input: DynamicPreviewInput,
		private readonly _contentProvider: TextileContentProvider,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		private readonly _logger: Logger,
		private readonly _topmostLineMonitor: TopmostLineMonitor,
		private readonly _contributionProvider: TextileContributionProvider,
		private readonly _engine: TextileEngine,
	) {
		super();

		this._webviewPanel = webview;

		this._resourceColumn = input.resourceColumn;
		this._locked = input.locked;

		this._preview = this.createPreview(input.resource, typeof input.line === 'number' ? new StartingScrollLine(input.line) : undefined);

		this._register(webview.onDidDispose(() => { this.dispose(); }));

		this._register(this._webviewPanel.onDidChangeViewState(e => {
			this._onDidChangeViewStateEmitter.fire(e);
		}));

		this._register(this._topmostLineMonitor.onDidChanged(event => {
			if (this._preview.isPreviewOf(event.resource)) {
				this._preview.scrollTo(event.line);
			}
		}));

		this._register(vscode.window.onDidChangeTextEditorSelection(event => {
			if (this._preview.isPreviewOf(event.textEditor.document.uri)) {
				this._preview.postMessage({
					type: 'onDidChangeTextEditorSelection',
					line: event.selections[0].active.line,
					source: this._preview.resource.toString()
				});
			}
		}));

		this._register(vscode.window.onDidChangeActiveTextEditor(editor => {
			// Only allow previewing normal text editors which have a viewColumn: See #101514
			if (typeof editor?.viewColumn === 'undefined') {
				return;
			}

			if (isTextileFile(editor.document) && !this._locked && !this._preview.isPreviewOf(editor.document.uri)) {
				const line = getVisibleLine(editor);
				this.update(editor.document.uri, line ? new StartingScrollLine(line) : undefined);
			}
		}));
	}

	private readonly _onDisposeEmitter = this._register(new vscode.EventEmitter<void>());
	public readonly onDispose = this._onDisposeEmitter.event;

	private readonly _onDidChangeViewStateEmitter = this._register(new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>());
	public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

	dispose() {
		this._preview.dispose();
		this._webviewPanel.dispose();

		this._onDisposeEmitter.fire();
		this._onDisposeEmitter.dispose();
		super.dispose();
	}

	public get resource() {
		return this._preview.resource;
	}

	public get resourceColumn() {
		return this._resourceColumn;
	}

	public reveal(viewColumn: vscode.ViewColumn) {
		this._webviewPanel.reveal(viewColumn);
	}

	public refresh() {
		this._preview.refresh();
	}

	public updateConfiguration() {
		if (this._previewConfigurations.hasConfigurationChanged(this._preview.resource)) {
			this.refresh();
		}
	}

	public update(newResource: vscode.Uri, scrollLocation?: StartingScrollLocation) {
		if (this._preview.isPreviewOf(newResource)) {
			switch (scrollLocation?.type) {
				case 'line':
					this._preview.scrollTo(scrollLocation.line);
					return;

				case 'fragment':
					// Workaround. For fragments, just reload the entire preview
					break;

				default:
					return;
			}
		}

		this._preview.dispose();
		this._preview = this.createPreview(newResource, scrollLocation);
	}

	public toggleLock() {
		this._locked = !this._locked;
		this._webviewPanel.title = DynamicTextilePreview.getPreviewTitle(this._preview.resource, this._locked);
	}

	private static getPreviewTitle(resource: vscode.Uri, locked: boolean): string {
		return locked
			? localize('lockedPreviewTitle', '[Preview] {0}', path.basename(resource.fsPath))
			: localize('previewTitle', 'Preview {0}', path.basename(resource.fsPath));
	}

	public get position(): vscode.ViewColumn | undefined {
		return this._webviewPanel.viewColumn;
	}

	public matchesResource(
		otherResource: vscode.Uri,
		otherPosition: vscode.ViewColumn | undefined,
		otherLocked: boolean
	): boolean {
		if (this.position !== otherPosition) {
			return false;
		}

		if (this._locked) {
			return otherLocked && this._preview.isPreviewOf(otherResource);
		} else {
			return !otherLocked;
		}
	}

	public matches(otherPreview: DynamicTextilePreview): boolean {
		return this.matchesResource(otherPreview._preview.resource, otherPreview.position, otherPreview._locked);
	}

	private createPreview(resource: vscode.Uri, startingScroll?: StartingScrollLocation): TextilePreview {
		return new TextilePreview(this._webviewPanel, resource, startingScroll, {
			getTitle: (resource) => DynamicTextilePreview.getPreviewTitle(resource, this._locked),
			getAdditionalState: () => {
				return {
					resourceColumn: this.resourceColumn,
					locked: this._locked,
				};
			},
			openPreviewLinkToTextileFile: (link: vscode.Uri, fragment?: string) => {
				this.update(link, fragment ? new StartingScrollFragment(fragment) : undefined);
			}
		},
			this._engine,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._contributionProvider);
	}
}

