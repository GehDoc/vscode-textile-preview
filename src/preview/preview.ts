/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as uri from 'vscode-uri';
import { ILogger } from '../logging';
import { TextileContributionProvider } from '../textileExtensions';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { Disposable } from '../util/dispose';
import { isTextileFile } from '../util/file';
import { openDocumentLink, resolveDocumentLink, resolveUriToTextileFile } from '../util/openDocumentLink';
import { WebviewResourceProvider } from '../util/resources';
import { urlToUri } from '../util/url';
import { ITextileWorkspace } from '../workspace';
import { TextileDocumentRenderer } from './documentRenderer';
import { TextilePreviewConfigurationManager } from './previewConfig';
import { scrollEditorToLine, StartingScrollFragment, StartingScrollLine, StartingScrollLocation } from './scrolling';
import { getVisibleLine, LastScrollLocation, TopmostLineMonitor } from './topmostLineMonitor';

const localize = nls.loadMessageBundle();

interface WebviewMessage {
	readonly source: string;
}

interface CacheImageSizesMessage extends WebviewMessage {
	readonly type: 'cacheImageSizes';
	readonly body: { id: string; width: number; height: number }[];
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

	public readonly resource: vscode.Uri;
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
	getAdditionalState(): {};
	openPreviewLinkToTextileFile(textileLink: vscode.Uri, fragment: string): void;
}


class TextilePreview extends Disposable implements WebviewResourceProvider {

	private static readonly unwatchedImageSchemes = new Set(['https', 'http', 'data']);

	private _disposed: boolean = false;

	private readonly delay = 300;
	private throttleTimer: any;

	private readonly _resource: vscode.Uri;
	private readonly _webviewPanel: vscode.WebviewPanel;

	private line: number | undefined;
	private scrollToFragment: string | undefined;
	private firstUpdate = true;
	private currentVersion?: PreviewDocumentVersion;
	private isScrolling = false;

	private imageInfo: { readonly id: string; readonly width: number; readonly height: number }[] = [];
	private readonly _fileWatchersBySrc = new Map</* src: */ string, vscode.FileSystemWatcher>();

	private readonly _onScrollEmitter = this._register(new vscode.EventEmitter<LastScrollLocation>());
	public readonly onScroll = this._onScrollEmitter.event;

	private readonly _disposeCts = this._register(new vscode.CancellationTokenSource());

	constructor(
		webview: vscode.WebviewPanel,
		resource: vscode.Uri,
		startingScroll: StartingScrollLocation | undefined,
		private readonly delegate: TextilePreviewDelegate,
		private readonly _contentProvider: TextileDocumentRenderer,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		private readonly _workspace: ITextileWorkspace,
		private readonly _logger: ILogger,
		private readonly _contributionProvider: TextileContributionProvider,
		private readonly _tocProvider: TextileTableOfContentsProvider,
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
			setTimeout(() => this.refresh(), 0);
		}));

		this._register(vscode.workspace.onDidChangeTextDocument(event => {
			if (this.isPreviewOf(event.document.uri)) {
				this.refresh();
			}
		}));

		this._register(vscode.workspace.onDidOpenTextDocument(document => {
			if (this.isPreviewOf(document.uri)) {
				this.refresh();
			}
		}));

		const watcher = this._register(vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(resource, '*')));
		this._register(watcher.onDidChange(uri => {
			if (this.isPreviewOf(uri)) {
				// Only use the file system event when VS Code does not already know about the file
				if (!vscode.workspace.textDocuments.some(doc => doc.uri.toString() !== uri.toString())) {
					this.refresh();
				}
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

	override dispose() {
		this._disposeCts.cancel();

		super.dispose();

		this._disposed = true;

		clearTimeout(this.throttleTimer);
		for (const entry of this._fileWatchersBySrc.values()) {
			entry.dispose();
		}
		this._fileWatchersBySrc.clear();
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

	/**
	 * The first call immediately refreshes the preview,
	 * calls happening shortly thereafter are debounced.
	*/
	public refresh(forceUpdate: boolean = false) {
		// Schedule update if none is pending
		if (!this.throttleTimer) {
			if (this.firstUpdate) {
				this.updatePreview(true);
			} else {
				this.throttleTimer = setTimeout(() => this.updatePreview(forceUpdate), this.delay);
			}
		}

		this.firstUpdate = false;
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

		this._logger.verbose('TextilePreview', 'updateForView', { textileFile: this._resource });
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
			if (!this._disposed) {
				await this.showFileNotFoundError();
			}
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

		const shouldReloadPage = forceUpdate || !this.currentVersion || this.currentVersion.resource.toString() !== pendingVersion.resource.toString() || !this._webviewPanel.visible;
		this.currentVersion = pendingVersion;

		const content = await (shouldReloadPage
			? this._contentProvider.renderDocument(document, this, this._previewConfigurations, this.line, this.state, this._disposeCts.token)
			: this._contentProvider.renderBody(document, this));

		// Another call to `doUpdate` may have happened.
		// Make sure we are still updating for the correct document
		if (this.currentVersion?.equals(pendingVersion)) {
			this.updateWebviewContent(content.html, shouldReloadPage);
			this.updateImageWatchers(content.containingImages);
		}
	}

	private onDidScrollPreview(line: number) {
		this.line = line;
		this._onScrollEmitter.fire({ line: this.line, uri: this._resource });
		const config = this._previewConfigurations.loadAndCacheConfiguration(this._resource);
		if (!config.scrollEditorWithPreview) {
			return;
		}

		for (const editor of vscode.window.visibleTextEditors) {
			if (!this.isPreviewOf(editor.document.uri)) {
				continue;
			}

			this.isScrolling = true;
			scrollEditorToLine(line, editor);
		}
	}

	private async onDidClickPreview(line: number): Promise<void> {
		// fix #82457, find currently opened but unfocused source tab
		await vscode.commands.executeCommand('textile.showSource');

		const revealLineInEditor = (editor: vscode.TextEditor) => {
			const position = new vscode.Position(line, 0);
			const newSelection = new vscode.Selection(position, position);
			editor.selection = newSelection;
			editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
		};

		for (const visibleEditor of vscode.window.visibleTextEditors) {
			if (this.isPreviewOf(visibleEditor.document.uri)) {
				const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
				revealLineInEditor(editor);
				return;
			}
		}

		await vscode.workspace.openTextDocument(this._resource)
			.then(vscode.window.showTextDocument)
			.then((editor) => {
				revealLineInEditor(editor);
			}, () => {
				vscode.window.showErrorMessage(localize('preview.clickOpenFailed', 'Could not open {0}', this._resource.toString()));
			});
	}

	private async showFileNotFoundError() {
		this._webviewPanel.webview.html = this._contentProvider.renderFileNotFoundDocument(this._resource);
	}

	private updateWebviewContent(html: string, reloadPage: boolean): void {
		if (this._disposed) {
			return;
		}

		if (this.delegate.getTitle) {
			this._webviewPanel.title = this.delegate.getTitle(this._resource);
		}
		this._webviewPanel.webview.options = this.getWebviewOptions();

		if (reloadPage) {
			this._webviewPanel.webview.html = html;
		} else {
			this._webviewPanel.webview.postMessage({
				type: 'updateContent',
				content: html,
				source: this._resource.toString(),
			});
		}
	}

	private updateImageWatchers(containingImages: { src: string }[]) {
		const srcs = new Set(containingImages.map(img => img.src));

		// Delete stale file watchers.
		for (const [src, watcher] of this._fileWatchersBySrc) {
			if (!srcs.has(src)) {
				watcher.dispose();
				this._fileWatchersBySrc.delete(src);
			}
		}

		// Create new file watchers.
		const root = vscode.Uri.joinPath(this._resource, '../');
		for (const src of srcs) {
			const uri = urlToUri(src, root);
			if (uri && !TextilePreview.unwatchedImageSchemes.has(uri.scheme) && !this._fileWatchersBySrc.has(src)) {
				const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(uri, '*'));
				watcher.onDidChange(() => {
					this.refresh(true);
				});
				this._fileWatchersBySrc.set(src, watcher);
			}
		}
	}

	private getWebviewOptions(): vscode.WebviewOptions {
		return {
			enableScripts: true,
			enableForms: false,
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
		} else {
			baseRoots.push(uri.Utils.dirname(this._resource));
		}

		return baseRoots;
	}

	private async onDidClickPreviewLink(href: string) {
		const targetResource = resolveDocumentLink(href, this.resource);

		const config = vscode.workspace.getConfiguration('textile', this.resource);
		const openLinks = config.get<string>('preview.openTextileLinks', 'inPreview');
		if (openLinks === 'inPreview') {
			const linkedDoc = await resolveUriToTextileFile(this._workspace, targetResource);
			if (linkedDoc) {
				this.delegate.openPreviewLinkToTextileFile(linkedDoc.uri, targetResource.fragment);
				return;
			}
		}

		return openDocumentLink(this._tocProvider, targetResource, this.resource);
	}

	//#region WebviewResourceProvider

	asWebviewUri(resource: vscode.Uri) {
		return this._webviewPanel.webview.asWebviewUri(resource);
	}

	get cspSource() {
		return this._webviewPanel.webview.cspSource;
	}

	//#endregion
}

export interface IManagedTextilePreview {

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

export class StaticTextilePreview extends Disposable implements IManagedTextilePreview {

	public static readonly customEditorViewType = 'vscode.textile.preview.editor';

	public static revive(
		resource: vscode.Uri,
		webview: vscode.WebviewPanel,
		contentProvider: TextileDocumentRenderer,
		previewConfigurations: TextilePreviewConfigurationManager,
		topmostLineMonitor: TopmostLineMonitor,
		workspace: ITextileWorkspace,
		logger: ILogger,
		contributionProvider: TextileContributionProvider,
		tocProvider: TextileTableOfContentsProvider,
		scrollLine?: number,
	): StaticTextilePreview {
		return new StaticTextilePreview(webview, resource, contentProvider, previewConfigurations, topmostLineMonitor, workspace, logger, contributionProvider, tocProvider, scrollLine);
	}

	private readonly preview: TextilePreview;

	private constructor(
		private readonly _webviewPanel: vscode.WebviewPanel,
		resource: vscode.Uri,
		contentProvider: TextileDocumentRenderer,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		topmostLineMonitor: TopmostLineMonitor,
		workspace: ITextileWorkspace,
		logger: ILogger,
		contributionProvider: TextileContributionProvider,
		tocProvider: TextileTableOfContentsProvider,
		scrollLine?: number,
	) {
		super();
		const topScrollLocation = scrollLine ? new StartingScrollLine(scrollLine) : undefined;
		this.preview = this._register(new TextilePreview(this._webviewPanel, resource, topScrollLocation, {
			getAdditionalState: () => { return {}; },
			openPreviewLinkToTextileFile: (textileLink, fragment) => {
				return vscode.commands.executeCommand('vscode.openWith', textileLink.with({
					fragment
				}), StaticTextilePreview.customEditorViewType, this._webviewPanel.viewColumn);
			}
		}, contentProvider, _previewConfigurations, workspace, logger, contributionProvider, tocProvider));

		this._register(this._webviewPanel.onDidDispose(() => {
			this.dispose();
		}));

		this._register(this._webviewPanel.onDidChangeViewState(e => {
			this._onDidChangeViewState.fire(e);
		}));

		this._register(this.preview.onScroll((scrollInfo) => {
			topmostLineMonitor.setPreviousStaticEditorLine(scrollInfo);
		}));

		this._register(topmostLineMonitor.onDidChanged(event => {
			if (this.preview.isPreviewOf(event.resource)) {
				this.preview.scrollTo(event.line);
			}
		}));
	}

	private readonly _onDispose = this._register(new vscode.EventEmitter<void>());
	public readonly onDispose = this._onDispose.event;

	private readonly _onDidChangeViewState = this._register(new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>());
	public readonly onDidChangeViewState = this._onDidChangeViewState.event;

	override dispose() {
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
		this.preview.refresh(true);
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

export class DynamicTextilePreview extends Disposable implements IManagedTextilePreview {

	public static readonly viewType = 'textile.preview';

	private readonly _resourceColumn: vscode.ViewColumn;
	private _locked: boolean;

	private readonly _webviewPanel: vscode.WebviewPanel;
	private _preview: TextilePreview;

	public static revive(
		input: DynamicPreviewInput,
		webview: vscode.WebviewPanel,
		contentProvider: TextileDocumentRenderer,
		previewConfigurations: TextilePreviewConfigurationManager,
		workspace: ITextileWorkspace,
		logger: ILogger,
		topmostLineMonitor: TopmostLineMonitor,
		contributionProvider: TextileContributionProvider,
		tocProvider: TextileTableOfContentsProvider,
	): DynamicTextilePreview {
		webview.iconPath = contentProvider.iconPath;

		return new DynamicTextilePreview(webview, input,
			contentProvider, previewConfigurations, workspace, logger, topmostLineMonitor, contributionProvider, tocProvider);
	}

	public static create(
		input: DynamicPreviewInput,
		previewColumn: vscode.ViewColumn,
		contentProvider: TextileDocumentRenderer,
		previewConfigurations: TextilePreviewConfigurationManager,
		workspace: ITextileWorkspace,
		logger: ILogger,
		topmostLineMonitor: TopmostLineMonitor,
		contributionProvider: TextileContributionProvider,
		tocProvider: TextileTableOfContentsProvider,
	): DynamicTextilePreview {
		const webview = vscode.window.createWebviewPanel(
			DynamicTextilePreview.viewType,
			DynamicTextilePreview.getPreviewTitle(input.resource, input.locked),
			previewColumn, { enableFindWidget: true, });

		webview.iconPath = contentProvider.iconPath;

		return new DynamicTextilePreview(webview, input,
			contentProvider, previewConfigurations, workspace, logger, topmostLineMonitor, contributionProvider, tocProvider);
	}

	private constructor(
		webview: vscode.WebviewPanel,
		input: DynamicPreviewInput,
		private readonly _contentProvider: TextileDocumentRenderer,
		private readonly _previewConfigurations: TextilePreviewConfigurationManager,
		private readonly _workspace: ITextileWorkspace,
		private readonly _logger: ILogger,
		private readonly _topmostLineMonitor: TopmostLineMonitor,
		private readonly _contributionProvider: TextileContributionProvider,
		private readonly _tocProvider: TextileTableOfContentsProvider,
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

	override dispose() {
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
		this._preview.refresh(true);
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
		const resourceLabel = uri.Utils.basename(resource);
		return locked
			? localize('lockedPreviewTitle', '[Preview] {0}', resourceLabel)
			: localize('previewTitle', 'Preview {0}', resourceLabel);
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
			this._contentProvider,
			this._previewConfigurations,
			this._workspace,
			this._logger,
			this._contributionProvider,
			this._tocProvider);
	}
}
