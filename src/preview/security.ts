/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { TextilePreviewManager } from './previewManager';



const localize = nls.loadMessageBundle();

export const enum TextilePreviewSecurityLevel {
	Strict = 0,
	AllowInsecureContent = 1,
	AllowScriptsAndAllContent = 2,
	AllowInsecureLocalContent = 3
}

export interface ContentSecurityPolicyArbiter {
	getSecurityLevelForResource(resource: vscode.Uri): TextilePreviewSecurityLevel;

	setSecurityLevelForResource(resource: vscode.Uri, level: TextilePreviewSecurityLevel): Thenable<void>;

	shouldAllowSvgsForResource(resource: vscode.Uri): void;

	shouldDisableSecurityWarnings(): boolean;

	setShouldDisableSecurityWarning(shouldShow: boolean): Thenable<void>;
}

export class ExtensionContentSecurityPolicyArbiter implements ContentSecurityPolicyArbiter {
	private readonly old_trusted_workspace_key = 'trusted_preview_workspace:';
	private readonly security_level_key = 'preview_security_level:';
	private readonly should_disable_security_warning_key = 'preview_should_show_security_warning:';

	constructor(
		private readonly globalState: vscode.Memento,
		private readonly workspaceState: vscode.Memento
	) { }

	public getSecurityLevelForResource(resource: vscode.Uri): TextilePreviewSecurityLevel {
		// Use new security level setting first
		const level = this.globalState.get<TextilePreviewSecurityLevel | undefined>(this.security_level_key + this.getRoot(resource), undefined);
		if (typeof level !== 'undefined') {
			return level;
		}

		// Fallback to old trusted workspace setting
		if (this.globalState.get<boolean>(this.old_trusted_workspace_key + this.getRoot(resource), false)) {
			return TextilePreviewSecurityLevel.AllowScriptsAndAllContent;
		}
		return TextilePreviewSecurityLevel.Strict;
	}

	public setSecurityLevelForResource(resource: vscode.Uri, level: TextilePreviewSecurityLevel): Thenable<void> {
		return this.globalState.update(this.security_level_key + this.getRoot(resource), level);
	}

	public shouldAllowSvgsForResource(resource: vscode.Uri) {
		const securityLevel = this.getSecurityLevelForResource(resource);
		return securityLevel === TextilePreviewSecurityLevel.AllowInsecureContent || securityLevel === TextilePreviewSecurityLevel.AllowScriptsAndAllContent;
	}

	public shouldDisableSecurityWarnings(): boolean {
		return this.workspaceState.get<boolean>(this.should_disable_security_warning_key, false);
	}

	public setShouldDisableSecurityWarning(disabled: boolean): Thenable<void> {
		return this.workspaceState.update(this.should_disable_security_warning_key, disabled);
	}

	private getRoot(resource: vscode.Uri): vscode.Uri {
		if (vscode.workspace.workspaceFolders) {
			const folderForResource = vscode.workspace.getWorkspaceFolder(resource);
			if (folderForResource) {
				return folderForResource.uri;
			}

			if (vscode.workspace.workspaceFolders.length) {
				return vscode.workspace.workspaceFolders[0].uri;
			}
		}

		return resource;
	}
}

export class PreviewSecuritySelector {

	public constructor(
		private readonly cspArbiter: ContentSecurityPolicyArbiter,
		private readonly webviewManager: TextilePreviewManager
	) { }

	public async showSecuritySelectorForResource(resource: vscode.Uri): Promise<void> {
		interface PreviewSecurityPickItem extends vscode.QuickPickItem {
			readonly type: 'moreinfo' | 'toggle' | TextilePreviewSecurityLevel;
		}

		function markActiveWhen(when: boolean): string {
			return when ? '• ' : '';
		}

		const currentSecurityLevel = this.cspArbiter.getSecurityLevelForResource(resource);
		const selection = await vscode.window.showQuickPick<PreviewSecurityPickItem>(
			[
				{
					type: TextilePreviewSecurityLevel.Strict,
					label: markActiveWhen(currentSecurityLevel === TextilePreviewSecurityLevel.Strict) + localize('strict.title', 'Strict'),
					description: localize('strict.description', 'Only load secure content'),
				}, {
					type: TextilePreviewSecurityLevel.AllowInsecureLocalContent,
					label: markActiveWhen(currentSecurityLevel === TextilePreviewSecurityLevel.AllowInsecureLocalContent) + localize('insecureLocalContent.title', 'Allow insecure local content'),
					description: localize('insecureLocalContent.description', 'Enable loading content over http served from localhost'),
				}, {
					type: TextilePreviewSecurityLevel.AllowInsecureContent,
					label: markActiveWhen(currentSecurityLevel === TextilePreviewSecurityLevel.AllowInsecureContent) + localize('insecureContent.title', 'Allow insecure content'),
					description: localize('insecureContent.description', 'Enable loading content over http'),
				}, {
					type: TextilePreviewSecurityLevel.AllowScriptsAndAllContent,
					label: markActiveWhen(currentSecurityLevel === TextilePreviewSecurityLevel.AllowScriptsAndAllContent) + localize('disable.title', 'Disable'),
					description: localize('disable.description', 'Allow all content and script execution. Not recommended'),
				}, {
					type: 'moreinfo',
					label: localize('moreInfo.title', 'More Information'),
					description: ''
				}, {
					type: 'toggle',
					label: this.cspArbiter.shouldDisableSecurityWarnings()
						? localize('enableSecurityWarning.title', "Enable preview security warnings in this workspace")
						: localize('disableSecurityWarning.title', "Disable preview security warning in this workspace"),
					description: localize('toggleSecurityWarning.description', 'Does not affect the content security level')
				},
			], {
			placeHolder: localize(
				'preview.showPreviewSecuritySelector.title',
				'Select security settings for Textile previews in this workspace'),
		});
		if (!selection) {
			return;
		}

		if (selection.type === 'moreinfo') {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://go.microsoft.com/fwlink/?linkid=854414'));
			return;
		}

		if (selection.type === 'toggle') {
			this.cspArbiter.setShouldDisableSecurityWarning(!this.cspArbiter.shouldDisableSecurityWarnings());
			this.webviewManager.refresh();
			return;
		} else {
			await this.cspArbiter.setSecurityLevelForResource(resource, selection.type);
		}
		this.webviewManager.refresh();
	}
}
