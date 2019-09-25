/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { extname } from 'path';

import { Command } from '../commandManager';
import { TextileEngine } from '../textileEngine';
//import { TableOfContentsProvider } from '../tableOfContentsProvider';
import { isTextileFile } from '../util/file';


export interface OpenDocumentLinkArgs {
	path: string;
	fragment: string;
}

export class OpenDocumentLinkCommand implements Command {
	private static readonly id = '_textile.openDocumentLink';
	public readonly id = OpenDocumentLinkCommand.id;

	public static createCommandUri(
		path: string,
		fragment: string
	): vscode.Uri {
		return vscode.Uri.parse(`command:${OpenDocumentLinkCommand.id}?${encodeURIComponent(JSON.stringify({ path: encodeURIComponent(path), fragment }))}`);
	}

	public constructor(
		private readonly engine: TextileEngine
	) { }

	public execute(args: OpenDocumentLinkArgs) {
		const p = decodeURIComponent(args.path);
		return this.tryOpen(p, args).catch(() => {
			if (p && extname(p) === '') {
				return this.tryOpen(p + '.textile', args);
			}
			const resource = vscode.Uri.file(p);
			return Promise.resolve(undefined)
				.then(() => vscode.commands.executeCommand('vscode.open', resource))
				.then(() => undefined);
		});
	}

	private async tryOpen(path: string, args: OpenDocumentLinkArgs) {
		const resource = vscode.Uri.file(path);
		if (vscode.window.activeTextEditor && isTextileFile(vscode.window.activeTextEditor.document)) {
			if (!path || vscode.window.activeTextEditor.document.uri.fsPath === resource.fsPath) {
				return this.tryRevealLine(vscode.window.activeTextEditor, args.fragment);
			}
		}
		return vscode.workspace.openTextDocument(resource)
			.then(vscode.window.showTextDocument)
			.then(editor => this.tryRevealLine(editor, args.fragment));
	}

	private async tryRevealLine(editor: vscode.TextEditor, fragment?: string) {
		if (editor && fragment) {
			/* FIXME : supporter ?
			const toc = new TableOfContentsProvider(this.engine, editor.document);
			const entry = await toc.lookup(fragment);
			if (entry) {
				return editor.revealRange(new vscode.Range(entry.line, 0, entry.line, 0), vscode.TextEditorRevealType.AtTop);
			}
			*/
			const lineNumberFragment = fragment.match(/^L(\d+)$/i);
			if (lineNumberFragment) {
				const line = +lineNumberFragment[1] - 1;
				if (!isNaN(line)) {
					return editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.AtTop);
				}
			}
		}
	}
}


export async function resolveLinkToTextileFile(path: string): Promise<vscode.Uri | undefined> {
	try {
		const standardLink = await tryResolveLinkToTextileFile(path);
		if (standardLink) {
			return standardLink;
		}
	} catch {
		// Noop
	}

	// If no extension, try with `.textile` extension
	if (extname(path) === '') {
		return tryResolveLinkToTextileFile(path + '.textile');
	}

	return undefined;
}

async function tryResolveLinkToTextileFile(path: string): Promise<vscode.Uri | undefined> {
	const resource = vscode.Uri.file(path);

	let document: vscode.TextDocument;
	try {
		document = await vscode.workspace.openTextDocument(resource);
	} catch {
		return undefined;
	}
	if (isTextileFile(document)) {
		return document.uri;
	}
	return undefined;
}
