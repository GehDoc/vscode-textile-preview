/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as uri from 'vscode-uri';
import { OpenDocumentLinkCommand } from '../commands/openDocumentLink';
import { Token } from '../../libs/textile-js/textile';
import { TextileEngine, getLineNumber, getEndLineNumber } from '../textileEngine';
import { getUriForLinkWithKnownExternalScheme, isOfScheme, Schemes } from '../util/links';

const localize = nls.loadMessageBundle();

function parseLink(
	document: vscode.TextDocument,
	link: string,
): { uri: vscode.Uri; tooltip?: string } | undefined {
	// -- Begin: modified for textile
	// const cleanLink = stripAngleBrackets(link);
	const externalSchemeUri = getUriForLinkWithKnownExternalScheme(link);
	// -- End: modified for textile
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
			const base = uri.Utils.dirname(document.uri);
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

/* Disabled for textile
const angleBracketLinkRe = /^<(.*)>$/;

/**
 * Used to strip brackets from the textile link
 *
 * <http://example.com> will be transformed to http://example.com
* /
export function stripAngleBrackets(link: string) {
	return link.replace(angleBracketLinkRe, '$1');
}
*/

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

// -- Begin: Modified for textile
const linkPattern = /("(?!\s)((?:[^"]|"(?![\s:])[^\n"]+"(?!:))+)":)((?:[^\s()]|\([^\s()]+\)|[()])+?)(?=[!-\.:-@\[\\\]-`{-~]+(?:$|\s)|$|\s)|(\["([^\n]+?)":)((?:\[[a-z0-9]*\]|[^\]])+)\]/g
const imagePattern = /(!(?!\s)((?:\([^\)]+\)|\{[^\}]+\}|\\[[^\[\]]+\]|(?:<>|<|>|=)|[\(\)]+)*(?:\.[^\n\S]|\.(?:[^\.\/]))?)([^!\s]+?) ?(?:\(((?:[^\(\)]|\([^\(\)]+\))+)\))?!)(?::([^\s]+?(?=[!-\.:-@\[\\\]-`{-~](?:$|\s)|\s|$)))?/g
/* Disabled : not relevant for textile
const referenceLinkPattern = /(?:(\[((?:\\\]|[^\]])+)\]\[\s*?)([^\s\]]*?)\]|\[\s*?([^\s\]]*?)\])(?!\:)/g;
*/
const definitionPattern = /^\[([^\]]+)\]((?:https?:\/\/|[.]{1,2}\/|#)\S+)(?:\s*(?=\n)|$)/gm;
const inlineCodePattern = /(?:^|[^@])(@+)(?:.+?|.*?(?:(?:\r?\n).+?)*?)(?:\r?\n)?\1(?:$|[^@])/gm;
// -- End: Modified for textile

interface CodeInDocument {
	/**
	 * code blocks and fences each represented by [line_start,line_end).
	 */
	readonly multiline: ReadonlyArray<[number, number]>;

	/**
	 * inline code spans each represented by {@link vscode.Range}.
	 */
	readonly inline: readonly vscode.Range[];
}

// -- Begin: Modified for textile
async function findCode(document: vscode.TextDocument, engine: TextileEngine): Promise<CodeInDocument> {
	const tokens = await engine.parse(document);
	const jsonmlUtils = await engine.jsonmlUtils();
	const multiline = [] as [number, number][]
	jsonmlUtils.applyHooks(tokens, [
		[(token : Token) => {
			if (!!token.map && (token[0] === 'code' || token[0] === 'pre')) {
				const startLine = getLineNumber(token)
				const endLine = getEndLineNumber(token)
				if(startLine !== undefined && endLine !== undefined)
					multiline.push([startLine, endLine])
			}
			return token;
		}]
	]);

	const text = document.getText();
	const inline = [...text.matchAll(inlineCodePattern)].map(match => {
		const start = match.index || 0;
		return new vscode.Range(document.positionAt(start), document.positionAt(start + match[0].length));
	});

	return { multiline, inline };
}

function isLinkInsideCode(code: CodeInDocument, link: vscode.DocumentLink) {
	return code.multiline.some(interval => link.range.start.line >= interval[0] && link.range.start.line <= interval[1]) ||
		code.inline.some(position => position.intersection(link.range));
}
// -- End: Modified for textile


export default class LinkProvider implements vscode.DocumentLinkProvider {
	constructor(
		private readonly engine: TextileEngine
	) { }


	public async provideDocumentLinks(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): Promise<vscode.DocumentLink[]> {
		const text = document.getText();

		return [
			...(await this.providerInlineLinks(text, document)),
			/* Disabled : not relevant for textile
			...this.provideReferenceLinks(text, document)
			*/
		];
	}

	private async providerInlineLinks(
		text: string,
		document: vscode.TextDocument,
	): Promise<vscode.DocumentLink[]> {
		const results: vscode.DocumentLink[] = [];
		const codeInDocument = await findCode(document, this.engine);
		// -- Begin: Modified for textile

		// pasted from this.provideReferenceLinks
		const definitions = LinkProvider.getDefinitions(text, document);
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

		for (const match of text.matchAll(linkPattern)) {
			const matchLink = match[1] && getDocumentLink(document, definitions, match[1].length, match[3], match.index);
			if (matchLink && !isLinkInsideCode(codeInDocument, matchLink)) {
				results.push(matchLink);
			}
			const matchLinkFenced = match[6] && getDocumentLink(document, definitions, match[4].length, match[6], match.index);
			if (matchLinkFenced && !isLinkInsideCode(codeInDocument, matchLinkFenced)) {
				results.push(matchLinkFenced);
			}
		}
		for (const match of text.matchAll(imagePattern)) {
			const matchImage = extractDocumentLink(document, (match[2] ? match[2].length : 0) + 1, match[3], match.index);
			if (matchImage && !isLinkInsideCode(codeInDocument, matchImage)) {
				results.push(matchImage);
			}
			const matchLink = match[5] && getDocumentLink(document, definitions, match[1].length + 1, match[5], match.index);
			if (matchLink && !isLinkInsideCode(codeInDocument, matchLink)) {
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

		const definitions = LinkProvider.getDefinitions(text, document);
		for (const match of text.matchAll(referenceLinkPattern)) {
			let linkStart: vscode.Position;
			let linkEnd: vscode.Position;
			let reference = match[3];
			if (reference) { // [text][ref]
				const pre = match[1];
				const offset = (match.index || 0) + pre.length;
				linkStart = document.positionAt(offset);
				linkEnd = document.positionAt(offset + reference.length);
			} else if (match[4]) { // [ref][], [ref]
				reference = match[4];
				const offset = (match.index || 0) + 1;
				linkStart = document.positionAt(offset);
				linkEnd = document.positionAt(offset + reference.length);
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

	public static getDefinitions(text: string, document: vscode.TextDocument) {
		const out = new Map<string, { link: string; linkRange: vscode.Range }>();
		for (const match of text.matchAll(definitionPattern)) {
			// -- Begin: Modified for textile
			const reference = match[1];
			const link = match[2].trim();

			const offset = (match.index || 0) + reference.length + 2;
			const linkStart = document.positionAt(offset);
			const linkEnd = document.positionAt(offset + link.length);
			out.set(reference, {
				link: link,
				linkRange: new vscode.Range(linkStart, linkEnd)
			});
			// -- End: Modified for textile
		}
		return out;
	}
}
