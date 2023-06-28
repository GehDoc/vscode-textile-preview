/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from '../commandManager';
import { TextilePreviewManager } from '../preview/previewManager';
import { PreviewSecuritySelector } from '../preview/security';
import { isTextileFile } from '../util/file';

export class ShowPreviewSecuritySelectorCommand implements Command {
	public readonly id = 'textile.showPreviewSecuritySelector';

	public constructor(
		private readonly previewSecuritySelector: PreviewSecuritySelector,
		private readonly previewManager: TextilePreviewManager
	) { }

	public execute(resource: string | undefined) {
		if (this.previewManager.activePreviewResource) {
			this.previewSecuritySelector.showSecuritySelectorForResource(this.previewManager.activePreviewResource);
		} else if (resource) {
			const source = vscode.Uri.parse(resource);
			this.previewSecuritySelector.showSecuritySelectorForResource(source.query ? vscode.Uri.parse(source.query) : source);
		} else if (vscode.window.activeTextEditor && isTextileFile(vscode.window.activeTextEditor.document)) {
			this.previewSecuritySelector.showSecuritySelectorForResource(vscode.window.activeTextEditor.document.uri);
		}
	}
}
