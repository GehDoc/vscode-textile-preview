/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class TextilePreviewConfiguration {
	public static getForResource(resource: vscode.Uri) {
		return new TextilePreviewConfiguration(resource);
	}

	public readonly scrollBeyondLastLine: boolean;
	public readonly wordWrap: boolean;
	public readonly lineBreaks: boolean;
	public readonly doubleClickToSwitchToEditor: boolean;
	public readonly scrollEditorWithPreview: boolean;
	public readonly scrollPreviewWithEditor: boolean;
	public readonly markEditorSelection: boolean;

	public readonly lineHeight: number;
	public readonly fontSize: number;
	public readonly fontFamily: string | undefined;
	public readonly styles: string[];

	private constructor(resource: vscode.Uri) {
		const editorConfig = vscode.workspace.getConfiguration('editor', resource);
		const textileConfig = vscode.workspace.getConfiguration('textile', resource);
		const textileEditorConfig = vscode.workspace.getConfiguration('[textile]', resource);

		this.scrollBeyondLastLine = editorConfig.get<boolean>('scrollBeyondLastLine', false);

		this.wordWrap = editorConfig.get<string>('wordWrap', 'off') !== 'off';
		if (textileEditorConfig && textileEditorConfig['editor.wordWrap']) {
			this.wordWrap = textileEditorConfig['editor.wordWrap'] !== 'off';
		}

		this.scrollPreviewWithEditor = !!textileConfig.get<boolean>('preview.scrollPreviewWithEditor', true);
		this.scrollEditorWithPreview = !!textileConfig.get<boolean>('preview.scrollEditorWithPreview', true);
		this.lineBreaks = !!textileConfig.get<boolean>('preview.breaks', true); // Changed tu true for Textile
		this.doubleClickToSwitchToEditor = !!textileConfig.get<boolean>('preview.doubleClickToSwitchToEditor', true);
		this.markEditorSelection = !!textileConfig.get<boolean>('preview.markEditorSelection', true);

		this.fontFamily = textileConfig.get<string | undefined>('preview.fontFamily', undefined);
		this.fontSize = Math.max(8, +textileConfig.get<number>('preview.fontSize', NaN));
		this.lineHeight = Math.max(0.6, +textileConfig.get<number>('preview.lineHeight', NaN));

		this.styles = textileConfig.get<string[]>('styles', []);
	}

	public isEqualTo(otherConfig: TextilePreviewConfiguration) {
		for (let key in this) {
			if (this.hasOwnProperty(key) && key !== 'styles') {
				if (this[key] !== otherConfig[key]) {
					return false;
				}
			}
		}

		// Check styles
		if (this.styles.length !== otherConfig.styles.length) {
			return false;
		}
		for (let i = 0; i < this.styles.length; ++i) {
			if (this.styles[i] !== otherConfig.styles[i]) {
				return false;
			}
		}

		return true;
	}

	[key: string]: any;
}

export class TextilePreviewConfigurationManager {
	private readonly previewConfigurationsForWorkspaces = new Map<string, TextilePreviewConfiguration>();

	public loadAndCacheConfiguration(
		resource: vscode.Uri
	): TextilePreviewConfiguration {
		const config = TextilePreviewConfiguration.getForResource(resource);
		this.previewConfigurationsForWorkspaces.set(this.getKey(resource), config);
		return config;
	}

	public hasConfigurationChanged(
		resource: vscode.Uri
	): boolean {
		const key = this.getKey(resource);
		const currentConfig = this.previewConfigurationsForWorkspaces.get(key);
		const newConfig = TextilePreviewConfiguration.getForResource(resource);
		return (!currentConfig || !currentConfig.isEqualTo(newConfig));
	}

	private getKey(
		resource: vscode.Uri
	): string {
		const folder = vscode.workspace.getWorkspaceFolder(resource);
		return folder ? folder.uri.toString() : '';
	}
}
