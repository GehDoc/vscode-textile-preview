/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Logger } from '../logger';
import { TextileContributionProvider } from '../textileExtensions';
import { disposeAll, Disposable } from '../util/dispose';
import { TopmostLineMonitor } from '../util/topmostLineMonitor';
import { DynamicTextilePreview } from './preview';
import { TextilePreviewConfigurationManager } from './previewConfig';
import { TextileContentProvider } from './previewContentProvider';

export interface DynamicPreviewSettings {
	readonly resourceColumn: vscode.ViewColumn;
	readonly previewColumn: vscode.ViewColumn;
	readonly locked: boolean;
}

class PreviewStore extends Disposable {

	private readonly _previews = new Set<DynamicTextilePreview>();

	public dispose(): void {
		super.dispose();
		for (const preview of this._previews) {
			preview.dispose();
		}
		this._previews.clear();
	}

	[Symbol.iterator](): Iterator<DynamicTextilePreview> {
		return this._previews[Symbol.iterator]();
	}

	public get(resource: vscode.Uri, previewSettings: DynamicPreviewSettings): DynamicTextilePreview | undefined {
		for (const preview of this._previews) {
			if (preview.matchesResource(resource, previewSettings.previewColumn, previewSettings.locked)) {
				return preview;
			}
		}
		return undefined;
	}

	public add(preview: DynamicTextilePreview) {
		this._previews.add(preview);
	}

	public delete(preview: DynamicTextilePreview) {
		this._previews.delete(preview);
	}
}

export class TextilePreviewManager extends Disposable implements vscode.WebviewPanelSerializer /* FIXME : proposedapi : , vscode.WebviewEditorProvider */ {
	private static readonly textilePreviewActiveContextKey = 'textilePreviewFocus';

	private readonly _topmostLineMonitor = new TopmostLineMonitor();
	private readonly _previewConfigurations = new TextilePreviewConfigurationManager();

	private readonly _dynamicPreviews = this._register(new PreviewStore());
	private readonly _staticPreviews = this._register(new PreviewStore());

	private _activePreview: DynamicTextilePreview | undefined = undefined;

	public constructor(
		private readonly _contentProvider: TextileContentProvider,
		private readonly _logger: Logger,
		private readonly _contributions: TextileContributionProvider
	) {
		super();
		this._register(vscode.window.registerWebviewPanelSerializer(DynamicTextilePreview.viewType, this));
		// FIXME : proposedapi : this._register(vscode.window.registerWebviewEditorProvider('vscode.textile.preview.editor', this));
	}

	public refresh() {
		for (const preview of this._dynamicPreviews) {
			preview.refresh();
		}
		for (const preview of this._staticPreviews) {
			preview.refresh();
		}
	}

	public updateConfiguration() {
		for (const preview of this._dynamicPreviews) {
			preview.updateConfiguration();
		}
		for (const preview of this._staticPreviews) {
			preview.updateConfiguration();
		}
	}

	public openDynamicPreview(
		resource: vscode.Uri,
		settings: DynamicPreviewSettings
	): void {
		let preview = this._dynamicPreviews.get(resource, settings);
		if (preview) {
			preview.reveal(settings.previewColumn);
		} else {
			preview = this.createNewDynamicPreview(resource, settings);
		}

		preview.update(resource);
	}

	public get activePreviewResource() {
		return this._activePreview?.resource;
	}

	public get activePreviewResourceColumn() {
		return this._activePreview?.resourceColumn;
	}

	public toggleLock() {
		const preview = this._activePreview;
		if (preview) {
			preview.toggleLock();

			// Close any previews that are now redundant, such as having two dynamic previews in the same editor group
			for (const otherPreview of this._dynamicPreviews) {
				if (otherPreview !== preview && preview.matches(otherPreview)) {
					otherPreview.dispose();
				}
			}
		}
	}

	public async deserializeWebviewPanel(
		webview: vscode.WebviewPanel,
		state: any
	): Promise<void> {
		const resource = vscode.Uri.parse(state.resource);
		const locked = state.locked;
		const line = state.line;
		const resourceColumn = state.resourceColumn;

		const preview = await DynamicTextilePreview.revive(
			{ resource, locked, line, resourceColumn },
			webview,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._topmostLineMonitor,
			this._contributions);

		this.registerDynamicPreview(preview);
	}

	/* FIXME : proposedapi : 
	public async resolveWebviewEditor(
		input: { readonly resource: vscode.Uri; },
		webview: vscode.WebviewPanel
	): Promise<vscode.WebviewEditorCapabilities> {
		const preview = DynamicTextilePreview.revive(
			{ resource: input.resource, locked: false, resourceColumn: vscode.ViewColumn.One },
			webview,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._topmostLineMonitor,
			this._contributions);
		this.registerStaticPreview(preview);
		return {};
	}
	*/

	private createNewDynamicPreview(
		resource: vscode.Uri,
		previewSettings: DynamicPreviewSettings
	): DynamicTextilePreview {
		const preview = DynamicTextilePreview.create(
			{
				resource,
				resourceColumn: previewSettings.resourceColumn,
				locked: previewSettings.locked,
			},
			previewSettings.previewColumn,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._topmostLineMonitor,
			this._contributions);

		this.setPreviewActiveContext(true);
		this._activePreview = preview;
		return this.registerDynamicPreview(preview);
	}

	private registerDynamicPreview(preview: DynamicTextilePreview): DynamicTextilePreview {
		this._dynamicPreviews.add(preview);

		preview.onDispose(() => {
			this._dynamicPreviews.delete(preview);
		});

		this.trackActive(preview);

		preview.onDidChangeViewState(() => {
			// Remove other dynamic previews in our column
			disposeAll(Array.from(this._dynamicPreviews).filter(otherPreview => preview !== otherPreview && preview.matches(otherPreview)));
		});
		return preview;
	}

	private registerStaticPreview(preview: DynamicTextilePreview): DynamicTextilePreview {
		this._staticPreviews.add(preview);

		preview.onDispose(() => {
			this._staticPreviews.delete(preview);
		});

		this.trackActive(preview);
		return preview;
	}

	private trackActive(preview: DynamicTextilePreview): void {
		preview.onDidChangeViewState(({ webviewPanel }) => {
			this.setPreviewActiveContext(webviewPanel.active);
			this._activePreview = webviewPanel.active ? preview : undefined;
		});

		preview.onDispose(() => {
			if (this._activePreview === preview) {
				this.setPreviewActiveContext(false);
				this._activePreview = undefined;
			}
		});
	}

	private setPreviewActiveContext(value: boolean) {
		vscode.commands.executeCommand('setContext', TextilePreviewManager.textilePreviewActiveContextKey, value);
	}
}

