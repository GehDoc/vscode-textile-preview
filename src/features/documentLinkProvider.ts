/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { OpenDocumentLinkCommand } from '../commands/openDocumentLink';
import { getUriForLinkWithKnownExternalScheme, isOfScheme, Schemes } from '../util/links';
import { dirname } from '../util/path';

const localize = nls.loadMessageBundle();

function parseLink(
	document: vscode.TextDocument,
	link: string,
): { uri: vscode.Uri, tooltip?: string } | undefined {
	const cleanLink = stripAngleBrackets(link);
	const externalSchemeUri = getUriForLinkWithKnownExternalScheme(cleanLink);
	if (externalSchemeUri) {
		// Normalize VS Code links to target currently running version
		if (isOfScheme(Schemes.vscode, link) || isOfScheme(Schemes['vscode-insiders'], link)) {
			return { uri: vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }) };
		}
		return { uri: externalSchemeUri };
	}

	// Assume it must be an relative or absolute file path
	// Use a fake scheme to avoid parse warnings
	const tempUri = vscode.Uri.parse(`vscode-resource:${link}`);

	let resourceUri: vscode.Uri | undefined;
	if (!tempUri.path) {
		resourceUri = document.uri;
	} else if (tempUri.path[0] === '/') {
		const root = getWorkspaceFolder(document);
		if (root) {
			resourceUri = vscode.Uri.joinPath(root, tempUri.path);
		}
	} else {
		if (document.uri.scheme === Schemes.untitled) {
			const root = getWorkspaceFolder(document);
			if (root) {
				resourceUri = vscode.Uri.joinPath(root, tempUri.path);
			}
		} else {
			const base = document.uri.with({ path: dirname(document.uri.fsPath) });
			resourceUri = vscode.Uri.joinPath(base, tempUri.path);
		}
	}

	if (!resourceUri) {
		return undefined;
	}

	resourceUri = resourceUri.with({ fragment: tempUri.fragment });

	return {
		uri: OpenDocumentLinkCommand.createCommandUri(document.uri, resourceUri, tempUri.fragment),
		tooltip: localize('documentLink.tooltip', 'Follow link')
	};
}

function getWorkspaceFolder(document: vscode.TextDocument) {
	return vscode.workspace.getWorkspaceFolder(document.uri)?.uri
		|| vscode.workspace.workspaceFolders?.[0]?.uri;
}

function extractDocumentLink(
	document: vscode.TextDocument,
	pre: number,
	link: string,
	matchIndex: number | undefined
): vscode.DocumentLink | undefined {
	const offset = (matchIndex || 0) + pre;
	const linkStart = document.positionAt(offset);
	const linkEnd = document.positionAt(offset + link.length);
	try {
		const linkData = parseLink(document, link);
		if (!linkData) {
			return undefined;
		}
		const documentLink = new vscode.DocumentLink(
			new vscode.Range(linkStart, linkEnd),
			linkData.uri);
		documentLink.tooltip = linkData.tooltip;
		return documentLink;
	} catch (e) {
		return undefined;
	}
}

/* Used to strip brackets from the textile link
	<http://example.com> will be transformed to
	http://example.com
*/
export function stripAngleBrackets(link: string) {
	const bracketMatcher = /^<(.*)>$/;
	return link.replace(bracketMatcher, '$1');
}

// -- Begin: Added for textile
function getDocumentLink(
	document: vscode.TextDocument,
	definitions: Map<string, { link: string, linkRange: vscode.Range }>,
	pre: number,
	link: string,
	matchIndex: number | undefined
): vscode.DocumentLink | undefined {
	const refLink = definitions.get(link);
	if (refLink) {
		try {
			const offset = (matchIndex || 0) + pre;
			let linkStart = document.positionAt(offset);
			let linkEnd = document.positionAt(offset + link.length);

			return new vscode.DocumentLink(
				new vscode.Range(linkStart, linkEnd),
				vscode.Uri.parse(`command:_textile.moveCursorToPosition?${encodeURIComponent(JSON.stringify([refLink.linkRange.start.line, refLink.linkRange.start.character]))}`));
		} catch (e) {
			return undefined;
		}
	} else {
		return extractDocumentLink(document, pre, link, matchIndex);
	}
}

function compareLinkRanges(a: vscode.DocumentLink, b: vscode.DocumentLink): number {
	if( a.range.start.line < b.range.start.line ) {
		return -1;
	} else if( a.range.start.line > b.range.start.line ) {
		return 1;
	}
	return a.range.start.character - b.range.start.character;
}
// -- End: Added for textile

export default class LinkProvider implements vscode.DocumentLinkProvider {
	// -- Begin: Modified for textile
	private readonly linkPattern = /("(?!\s)((?:[^"]|"(?![\s:])[^\n"]+"(?!:))+)":)((?:[^\s()]|\([^\s()]+\)|[()])+?)(?=[!-\.:-@\[\\\]-`{-~]+(?:$|\s)|$|\s)|(\["([^\n]+?)":)((?:\[[a-z0-9]*\]|[^\]])+)\]/g
	private readonly imagePattern = /(!(?!\s)((?:\([^\)]+\)|\{[^\}]+\}|\\[[^\[\]]+\]|(?:<>|<|>|=)|[\(\)]+)*(?:\.[^\n\S]|\.(?:[^\.\/]))?)([^!\s]+?) ?(?:\(((?:[^\(\)]|\([^\(\)]+\))+)\))?!)(?::([^\s]+?(?=[!-\.:-@\[\\\]-`{-~](?:$|\s)|\s|$)))?/g

	/* Disabled : not relevant for textile
	private readonly referenceLinkPattern = /(\[((?:\\\]|[^\]])+)\]\[\s*?)([^\s\]]*?)\]/g; // FIXME : recreate for textile
	*/
	private readonly definitionPattern = /^\[([^\]]+)\]((?:https?:\/\/|\/)\S+)(?:\s*(?=\n)|$)/gm;
	// -- End: Modified for textile

	public provideDocumentLinks(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): vscode.DocumentLink[] {
		const text = document.getText();

		return [
			...this.providerInlineLinks(text, document),
			/* Disabled : not relevant for textile
			...this.provideReferenceLinks(text, document)
			*/
		];
	}

	private providerInlineLinks(
		text: string,
		document: vscode.TextDocument,
	): vscode.DocumentLink[] {
		const results: vscode.DocumentLink[] = [];
		// -- Begin: Modified for textile

		// pasted from this.provideReferenceLinks
		const definitions = this.getDefinitions(text, document);
		for (const definition of definitions.values()) {
			try {
				const linkData = parseLink(document, definition.link);
				if (linkData) {
					results.push(new vscode.DocumentLink(definition.linkRange, linkData.uri));
				}
			} catch (e) {
				// noop
			}
		}

		for (const match of text.matchAll(this.linkPattern)) {
			const matchLink = match[1] && getDocumentLink(document, definitions, match[1].length, match[3], match.index);
			if (matchLink) {
				results.push(matchLink);
			}
			const matchLinkFenced = match[6] && getDocumentLink(document, definitions, match[4].length, match[6], match.index);
			if (matchLinkFenced) {
				results.push(matchLinkFenced);
			}
		}
		for (const match of text.matchAll(this.imagePattern)) {
			const matchImage = extractDocumentLink(document, (match[2] ? match[2].length : 0) + 1, match[3], match.index);
			if (matchImage) {
				results.push(matchImage);
			}
			const matchLink = match[5] && getDocumentLink(document, definitions, match[1].length + 1, match[5], match.index);
			if (matchLink) {
				results.push(matchLink);
			}
		}

		// The array have to be sorted. If not, some tooltips are doubled !
		results.sort(compareLinkRanges);

		// -- End: Modified for textile
		return results;
	}

	/* Disabled : not relevant for textile
	private provideReferenceLinks(
		text: string,
		document: vscode.TextDocument,
	): vscode.DocumentLink[] {
		const results: vscode.DocumentLink[] = [];

		const definitions = this.getDefinitions(text, document);
		for (const match of text.matchAll(this.referenceLinkPattern)) {
			let linkStart: vscode.Position;
			let linkEnd: vscode.Position;
			let reference = match[3];
			if (reference) { // [text][ref]
				const pre = match[1];
				const offset = (match.index || 0) + pre.length;
				linkStart = document.positionAt(offset);
				linkEnd = document.positionAt(offset + reference.length);
			} else if (match[2]) { // [ref][]
				reference = match[2];
				const offset = (match.index || 0) + 1;
				linkStart = document.positionAt(offset);
				linkEnd = document.positionAt(offset + match[2].length);
			} else {
				continue;
			}

			try {
				const link = definitions.get(reference);
				if (link) {
					results.push(new vscode.DocumentLink(
						new vscode.Range(linkStart, linkEnd),
						vscode.Uri.parse(`command:_textile.moveCursorToPosition?${encodeURIComponent(JSON.stringify([link.linkRange.start.line, link.linkRange.start.character]))}`)));
				}
			} catch (e) {
				// noop
			}
		}

		for (const definition of definitions.values()) {
			try {
				const linkData = parseLink(document, definition.link);
				if (linkData) {
					results.push(new vscode.DocumentLink(definition.linkRange, linkData.uri));
				}
			} catch (e) {
				// noop
			}
		}

		return results;
	}
	*/

	private getDefinitions(text: string, document: vscode.TextDocument) {
		const out = new Map<string, { link: string, linkRange: vscode.Range }>();
		for (const match of text.matchAll(this.definitionPattern)) {
			// -- Begin: Modified for textile
			const reference = match[1];
			const link = match[2].trim();

			const offset = (match.index || 0) + reference.length + 2;
			const linkStart = document.positionAt(offset);
			const linkEnd = document.positionAt(offset + link.length);
			// -- End: Modified for textile
			out.set(reference, {
				link: link,
				linkRange: new vscode.Range(linkStart, linkEnd)
			});
		}
		return out;
	}
}
