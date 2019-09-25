/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Logger } from '../logger';
import { TextileContributionProvider } from '../textileExtensions';
import { disposeAll, Disposable } from '../util/dispose';
import { TextileFileTopmostLineMonitor } from '../util/topmostLineMonitor';
import { TextilePreview, PreviewSettings } from './preview';
import { TextilePreviewConfigurationManager } from './previewConfig';
import { TextileContentProvider } from './previewContentProvider';


export class TextilePreviewManager extends Disposable implements vscode.WebviewPanelSerializer {
	private static readonly textilePreviewActiveContextKey = 'textilePreviewFocus';

	private readonly _topmostLineMonitor = new TextileFileTopmostLineMonitor();
	private readonly _previewConfigurations = new TextilePreviewConfigurationManager();
	private readonly _previews: TextilePreview[] = [];
	private _activePreview: TextilePreview | undefined = undefined;

	public constructor(
		private readonly _contentProvider: TextileContentProvider,
		private readonly _logger: Logger,
		private readonly _contributions: TextileContributionProvider
	) {
		super();
		this._register(vscode.window.registerWebviewPanelSerializer(TextilePreview.viewType, this));
	}

	public dispose(): void {
		super.dispose();
		disposeAll(this._previews);
	}

	public refresh() {
		for (const preview of this._previews) {
			preview.refresh();
		}
	}

	public updateConfiguration() {
		for (const preview of this._previews) {
			preview.updateConfiguration();
		}
	}

	public preview(
		resource: vscode.Uri,
		previewSettings: PreviewSettings
	): void {
		let preview = this.getExistingPreview(resource, previewSettings);
		if (preview) {
			preview.reveal(previewSettings.previewColumn);
		} else {
			preview = this.createNewPreview(resource, previewSettings);
		}

		preview.update(resource);
	}

	public get activePreviewResource() {
		return this._activePreview && this._activePreview.resource;
	}

	public get activePreviewResourceColumn() {
		return this._activePreview && this._activePreview.resourceColumn;
	}

	public toggleLock() {
		const preview = this._activePreview;
		if (preview) {
			preview.toggleLock();

			// Close any previews that are now redundant, such as having two dynamic previews in the same editor group
			for (const otherPreview of this._previews) {
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
		const preview = await TextilePreview.revive(
			webview,
			state,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._topmostLineMonitor,
			this._contributions);

		this.registerPreview(preview);
	}

	private getExistingPreview(
		resource: vscode.Uri,
		previewSettings: PreviewSettings
	): TextilePreview | undefined {
		return this._previews.find(preview =>
			preview.matchesResource(resource, previewSettings.previewColumn, previewSettings.locked));
	}

	private createNewPreview(
		resource: vscode.Uri,
		previewSettings: PreviewSettings
	): TextilePreview {
		const preview = TextilePreview.create(
			resource,
			previewSettings.previewColumn,
			previewSettings.resourceColumn,
			previewSettings.locked,
			this._contentProvider,
			this._previewConfigurations,
			this._logger,
			this._topmostLineMonitor,
			this._contributions);

		this.setPreviewActiveContext(true);
		this._activePreview = preview;
		return this.registerPreview(preview);
	}

	private registerPreview(
		preview: TextilePreview
	): TextilePreview {
		this._previews.push(preview);

		preview.onDispose(() => {
			const existing = this._previews.indexOf(preview);
			if (existing === -1) {
				return;
			}

			this._previews.splice(existing, 1);
			if (this._activePreview === preview) {
				this.setPreviewActiveContext(false);
				this._activePreview = undefined;
			}
		});

		preview.onDidChangeViewState(({ webviewPanel }) => {
			disposeAll(this._previews.filter(otherPreview => preview !== otherPreview && preview!.matches(otherPreview)));
			this.setPreviewActiveContext(webviewPanel.active);
			this._activePreview = webviewPanel.active ? preview : undefined;
		});

		return preview;
	}

	private setPreviewActiveContext(value: boolean) {
		vscode.commands.executeCommand('setContext', TextilePreviewManager.textilePreviewActiveContextKey, value);
	}
}

