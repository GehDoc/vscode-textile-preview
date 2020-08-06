/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { Logger } from '../logger';
import { TextileEngine } from '../textileEngine';
import { TextileContributionProvider } from '../textileExtensions';
import { ContentSecurityPolicyArbiter, TextilePreviewSecurityLevel } from '../security';
import { WebviewResourceProvider } from '../util/resources';
import { TextilePreviewConfiguration, TextilePreviewConfigurationManager } from './previewConfig';

const localize = nls.loadMessageBundle();

/**
 * Strings used inside the textile preview.
 *
 * Stored here and then injected in the preview so that they
 * can be localized using our normal localization process.
 */
const previewStrings = {
	cspAlertMessageText: localize(
		'preview.securityMessage.text',
		'Some content has been disabled in this document'),

	cspAlertMessageTitle: localize(
		'preview.securityMessage.title',
		'Potentially unsafe or insecure content has been disabled in the textile preview. Change the Textile preview security setting to allow insecure content or enable scripts'),

	cspAlertMessageLabel: localize(
		'preview.securityMessage.label',
		'Content Disabled Security Warning')
};

function escapeAttribute(value: string | vscode.Uri): string {
	return value.toString().replace(/"/g, '&quot;');
}

export class TextileContentProvider {
	constructor(
		private readonly engine: TextileEngine,
		private readonly context: vscode.ExtensionContext,
		private readonly cspArbiter: ContentSecurityPolicyArbiter,
		private readonly contributionProvider: TextileContributionProvider,
		private readonly logger: Logger
	) { }

	public async provideTextDocumentContent(
		textileDocument: vscode.TextDocument,
		resourceProvider: WebviewResourceProvider,
		previewConfigurations: TextilePreviewConfigurationManager,
		initialLine: number | undefined = undefined,
		state?: any
	): Promise<string> {
		const sourceUri = textileDocument.uri;
		const config = previewConfigurations.loadAndCacheConfiguration(sourceUri);
		const initialData = {
			source: sourceUri.toString(),
			line: initialLine,
			lineCount: textileDocument.lineCount,
			scrollPreviewWithEditor: config.scrollPreviewWithEditor,
			scrollEditorWithPreview: config.scrollEditorWithPreview,
			doubleClickToSwitchToEditor: config.doubleClickToSwitchToEditor,
			disableSecurityWarnings: this.cspArbiter.shouldDisableSecurityWarnings(),
			webviewResourceRoot: resourceProvider.asWebviewUri(textileDocument.uri).toString(),
		};

		this.logger.log('provideTextDocumentContent', initialData);

		// Content Security Policy
		const nonce = new Date().getTime() + '' + new Date().getMilliseconds();
		const csp = this.getCsp(resourceProvider, sourceUri, nonce);

		const body = await this.engine.render(textileDocument);
		// Changed for Textile :
		return `<!DOCTYPE html>
			<html style="${escapeAttribute(this.getSettingsOverrideStyles(config))}">
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				${csp}
				<meta id="vscode-textile-preview-data"
					data-settings="${escapeAttribute(JSON.stringify(initialData))}"
					data-strings="${escapeAttribute(JSON.stringify(previewStrings))}"
					data-state="${escapeAttribute(JSON.stringify(state || {}))}">
				<script src="${this.extensionResourcePath(resourceProvider, 'pre.js')}" nonce="${nonce}"></script>
				${this.getStyles(resourceProvider, sourceUri, config, state)}
				<base href="${resourceProvider.asWebviewUri(textileDocument.uri)}">
			</head>
			<body class="vscode-body ${config.scrollBeyondLastLine ? 'scrollBeyondLastLine' : ''} ${config.wordWrap ? 'wordWrap' : ''} ${config.markEditorSelection ? 'showEditorSelection' : ''}">
				<div id="text_preview">
					${body}
				</div>
				<div class="code-line" data-line="${textileDocument.lineCount}"></div>
				${this.getScripts(resourceProvider, nonce)}
			</body>
			</html>`;
	}

	public provideFileNotFoundContent(
		resource: vscode.Uri,
	): string {
		const resourcePath = path.basename(resource.fsPath);
		const body = localize('preview.notFound', '{0} cannot be found', resourcePath);
		// Changed for Textile :
		return `<!DOCTYPE html>
			<html>
			<body class="vscode-body">
				<div id="text_preview">
					${body}
				</div>
			</body>
			</html>`;
	}

	private extensionResourcePath(resourceProvider: WebviewResourceProvider, mediaFile: string): string {
		const webviewResource = resourceProvider.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', mediaFile));
		return webviewResource.toString();
	}

	private fixHref(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, href: string): string {
		if (!href) {
			return href;
		}

		if (href.startsWith('http:') || href.startsWith('https:') || href.startsWith('file:')) {
			return href;
		}

		// Assume it must be a local file
		if (path.isAbsolute(href)) {
			return resourceProvider.asWebviewUri(vscode.Uri.file(href)).toString();
		}

		// Use a workspace relative path if there is a workspace
		const root = vscode.workspace.getWorkspaceFolder(resource);
		if (root) {
			return resourceProvider.asWebviewUri(vscode.Uri.joinPath(root.uri, href)).toString();
		}

		// Otherwise look relative to the textile file
		return resourceProvider.asWebviewUri(vscode.Uri.file(path.join(path.dirname(resource.fsPath), href))).toString();
	}

	private computeCustomStyleSheetIncludes(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, config: TextilePreviewConfiguration): string {
		if (!Array.isArray(config.styles)) {
			return '';
		}
		const out: string[] = [];
		for (const style of config.styles) {
			out.push(`<link rel="stylesheet" class="code-user-style" data-source="${escapeAttribute(style)}" href="${escapeAttribute(this.fixHref(resourceProvider, resource, style))}" type="text/css" media="screen">`);
		}
		return out.join('\n');
	}

	private getSettingsOverrideStyles(config: TextilePreviewConfiguration): string {
		return [
			config.fontFamily ? `--textile-font-family: ${config.fontFamily};` : '',
			isNaN(config.fontSize) ? '' : `--textile-font-size: ${config.fontSize}px;`,
			isNaN(config.lineHeight) ? '' : `--textile-line-height: ${config.lineHeight};`,
		].join(' ');
	}

	private getImageStabilizerStyles(state?: any) {
		let ret = '<style>\n';
		if (state && state.imageInfo) {
			state.imageInfo.forEach((imgInfo: any) => {
				ret += `#${imgInfo.id}.loading {
					height: ${imgInfo.height}px;
					width: ${imgInfo.width}px;
				}\n`;
			});
		}
		ret += '</style>\n';

		return ret;
	}

	private getStyles(resourceProvider: WebviewResourceProvider, resource: vscode.Uri, config: TextilePreviewConfiguration, state?: any): string {
		const baseStyles: string[] = [];
		for (const resource of this.contributionProvider.contributions.previewStyles) {
			baseStyles.push(`<link rel="stylesheet" type="text/css" href="${escapeAttribute(resourceProvider.asWebviewUri(resource))}">`);
		}

		return `${baseStyles.join('\n')}
			${this.computeCustomStyleSheetIncludes(resourceProvider, resource, config)}
			${this.getImageStabilizerStyles(state)}`;
	}

	private getScripts(resourceProvider: WebviewResourceProvider, nonce: string): string {
		const out: string[] = [];
		for (const resource of this.contributionProvider.contributions.previewScripts) {
			out.push(`<script async
				src="${escapeAttribute(resourceProvider.asWebviewUri(resource))}"
				nonce="${nonce}"
				charset="UTF-8"></script>`);
		}
		return out.join('\n');
	}

	private getCsp(
		provider: WebviewResourceProvider,
		resource: vscode.Uri,
		nonce: string
	): string {
		const rule = provider.cspSource;
		switch (this.cspArbiter.getSecurityLevelForResource(resource)) {
			case TextilePreviewSecurityLevel.AllowInsecureContent:
				return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} http: https: data:; media-src 'self' ${rule} http: https: data:; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' http: https: data:; font-src 'self' ${rule} http: https: data:;">`;

			case TextilePreviewSecurityLevel.AllowInsecureLocalContent:
				return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*; media-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' https: data: http://localhost:* http://127.0.0.1:*; font-src 'self' ${rule} https: data: http://localhost:* http://127.0.0.1:*;">`;

			case TextilePreviewSecurityLevel.AllowScriptsAndAllContent:
				return '<meta http-equiv="Content-Security-Policy" content="">';

			case TextilePreviewSecurityLevel.Strict:
			default:
				return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' ${rule} https: data:; media-src 'self' ${rule} https: data:; script-src 'nonce-${nonce}'; style-src 'self' ${rule} 'unsafe-inline' https: data:; font-src 'self' ${rule} https: data:;">`;
		}
	}
}
