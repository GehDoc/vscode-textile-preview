/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from '../commandManager';
import { TextileEngine } from '../textileEngine';
import { TableOfContentsProvider } from '../tableOfContentsProvider';
import { isTextileFile } from '../util/file';
import { extname } from '../util/path';


type UriComponents = {
	readonly scheme?: string;
	readonly path: string;
	readonly fragment?: string;
	readonly authority?: string;
	readonly query?: string;
};

export interface OpenDocumentLinkArgs {
	readonly parts: UriComponents;
	readonly fragment: string;
	readonly fromResource: UriComponents;
}

enum OpenTextileLinks {
	beside = 'beside',
	currentGroup = 'currentGroup',
}

export class OpenDocumentLinkCommand implements Command {
	private static readonly id = '_textile.openDocumentLink';
	public readonly id = OpenDocumentLinkCommand.id;

	public static createCommandUri(
		fromResource: vscode.Uri,
		path: vscode.Uri,
		fragment: string,
	): vscode.Uri {
		const toJson = (uri: vscode.Uri): UriComponents => {
			return {
				scheme: uri.scheme,
				authority: uri.authority,
				path: uri.path,
				fragment: uri.fragment,
				query: uri.query,
			};
		};
		return vscode.Uri.parse(`command:${OpenDocumentLinkCommand.id}?${encodeURIComponent(JSON.stringify(<OpenDocumentLinkArgs>{
			parts: toJson(path),
			fragment,
			fromResource: toJson(fromResource),
		}))}`);
	}

	public constructor(
		private readonly engine: TextileEngine
	) { }

	public async execute(args: OpenDocumentLinkArgs) {
		return OpenDocumentLinkCommand.execute(this.engine, args);
	}

	public static async execute(engine: TextileEngine, args: OpenDocumentLinkArgs): Promise<void> {
		const fromResource = vscode.Uri.parse('').with(args.fromResource);

		const targetResource = reviveUri(args.parts);

		const column = this.getViewColumn(fromResource);

		const didOpen = await this.tryOpen(engine, targetResource, args, column);
		if (didOpen) {
			return;
		}

		if (extname(targetResource.path) === '') {
			await this.tryOpen(engine, targetResource.with({ path: targetResource.path + '.textile' }), args, column);
			return;
		}
	}

	private static async tryOpen(engine: TextileEngine, resource: vscode.Uri, args: OpenDocumentLinkArgs, column: vscode.ViewColumn): Promise<boolean> {
		const tryUpdateForActiveFile = async (): Promise<boolean> => {
			if (vscode.window.activeTextEditor && isTextileFile(vscode.window.activeTextEditor.document)) {
				if (vscode.window.activeTextEditor.document.uri.fsPath === resource.fsPath) {
					await this.tryRevealLine(engine, vscode.window.activeTextEditor, args.fragment);
					return true;
				}
			}
			return false;
		};

		if (await tryUpdateForActiveFile()) {
			return true;
		}

		let stat: vscode.FileStat;
		try {
			stat = await vscode.workspace.fs.stat(resource);
			if (stat.type === vscode.FileType.Directory) {
				await vscode.commands.executeCommand('revealInExplorer', resource);
				return true;
			}
		} catch {
			// noop
			// If resource doesn't exist, execute `vscode.open` either way so an error
			// notification is shown to the user with a create file action #113475
		}

		try {
			await vscode.commands.executeCommand('vscode.open', resource, column);
		} catch {
			return false;
		}

		return tryUpdateForActiveFile();
	}

	private static getViewColumn(resource: vscode.Uri): vscode.ViewColumn {
		const config = vscode.workspace.getConfiguration('textile', resource);
		const openLinks = config.get<OpenTextileLinks>('links.openLocation', OpenTextileLinks.currentGroup);
		switch (openLinks) {
			case OpenTextileLinks.beside:
				return vscode.ViewColumn.Beside;
			case OpenTextileLinks.currentGroup:
			default:
				return vscode.ViewColumn.Active;
		}
	}

	private static async tryRevealLine(engine: TextileEngine, editor: vscode.TextEditor, fragment?: string) {
		if (fragment) {
			const toc = new TableOfContentsProvider(engine, editor.document);
			const entry = await toc.lookup(fragment);
			if (entry) {
				const lineStart = new vscode.Range(entry.line, 0, entry.line, 0);
				editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
				return editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
			}
			const lineNumberFragment = fragment.match(/^L(\d+)$/i);
			if (lineNumberFragment) {
				const line = +lineNumberFragment[1] - 1;
				if (!isNaN(line)) {
					const lineStart = new vscode.Range(line, 0, line, 0);
					editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
					return editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
				}
			}
		}
	}
}

function reviveUri(parts: any) {
	if (parts.scheme === 'file') {
		return vscode.Uri.file(parts.path);
	}
	return vscode.Uri.parse('').with(parts);
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
