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
import { coalesce } from '../util/arrays';
import { getUriForLinkWithKnownExternalScheme, isOfScheme, Schemes } from '../util/schemes';
import { SkinnyTextDocument } from '../workspaceContents';

const localize = nls.loadMessageBundle();

export interface ExternalHref {
	readonly kind: 'external';
	readonly uri: vscode.Uri;
}

export interface InternalHref {
	readonly kind: 'internal';
	readonly path: vscode.Uri;
	readonly fragment: string;
}

export interface ReferenceHref {
	readonly kind: 'reference';
	readonly ref: string;
}

export type LinkHref = ExternalHref | InternalHref | ReferenceHref;
function parseLink(
	document: SkinnyTextDocument,
	link: string,
): ExternalHref | InternalHref | undefined {
	// -- Begin: modified for textile
	// const cleanLink = stripAngleBrackets(link);
	const externalSchemeUri = getUriForLinkWithKnownExternalScheme(link);
	// -- End: modified for textile
	if (externalSchemeUri) {
		// Normalize VS Code links to target currently running version
		if (isOfScheme(Schemes.vscode, link) || isOfScheme(Schemes['vscode-insiders'], link)) {
			return { kind: 'external', uri: vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }) };
		}
		return { kind: 'external', uri: externalSchemeUri };
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

	return {
		kind: 'internal',
		path: resourceUri.with({ fragment: '' }),
		fragment: tempUri.fragment,
	};
}

function getWorkspaceFolder(document: SkinnyTextDocument) {
	return vscode.workspace.getWorkspaceFolder(document.uri)?.uri
		|| vscode.workspace.workspaceFolders?.[0]?.uri;
}
interface TextileLinkSource {
	readonly text: string;
	readonly resource: vscode.Uri;
	readonly hrefRange: vscode.Range;
	readonly fragmentRange: vscode.Range | undefined;
}

export interface TextileInlineLink {
	readonly kind: 'link';
	readonly source: TextileLinkSource;
	readonly href: LinkHref;
}

export interface TextileLinkDefinition {
	readonly kind: 'definition';
	readonly source: TextileLinkSource;
	readonly ref: {
		readonly range: vscode.Range;
		readonly text: string;
	};
	readonly href: ExternalHref | InternalHref;
}

export type TextileLink = TextileInlineLink | TextileLinkDefinition;

function extractDocumentLink(
	document: SkinnyTextDocument,
	pre: number,
	link: string,
	matchIndex: number | undefined
): TextileLink | undefined {
	const offset = (matchIndex || 0) + pre;
	const linkStart = document.positionAt(offset);
	const linkEnd = document.positionAt(offset + link.length);
	try {
		const linkTarget = parseLink(document, link);
		if (!linkTarget) {
			return undefined;
		}
		return {
			kind: 'link',
			href: linkTarget,
			source: {
				text: link,
				resource: document.uri,
				hrefRange: new vscode.Range(linkStart, linkEnd),
				fragmentRange: getFragmentRange(link, linkStart, linkEnd),
			}
		};
	} catch {
		return undefined;
	}
}

function getFragmentRange(text: string, start: vscode.Position, end: vscode.Position): vscode.Range | undefined {
	const index = text.indexOf('#');
	if (index < 0) {
		return undefined;
	}
	return new vscode.Range(start.translate({ characterDelta: index + 1 }), end);
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


// -- Begin: Modified for textile

/**
 * Matches `"text":link`
 */
const linkPattern = /("(?!\s)((?:[^"]|"(?![\s:])[^\n"]+"(?!:))+)":)((?:[^\s()]|\([^\s()]+\)|[()])+?)(?=[!-\.:-@\[\\\]-`{-~]+(?:$|\s)|$|\s)|(\["([^\n]+?)":)((?:\[[a-z0-9]*\]|[^\]])+)\]/g

/**
 * Matches `!url(alt)!`
 */
const imagePattern = /(!(?!\s)((?:\([^\)]+\)|\{[^\}]+\}|\\[[^\[\]]+\]|(?:<>|<|>|=)|[\(\)]+)*(?:\.[^\n\S]|\.(?:[^\.\/]))?)([^!\s]+?) ?(?:\(((?:[^\(\)]|\([^\(\)]+\))+)\))?!)(?::([^\s]+?(?=[!-\.:-@\[\\\]-`{-~](?:$|\s)|\s|$)))?/g

/* Disabled : not relevant for textile
/**
 * Matches `[text][ref]`
 * /
const referenceLinkPattern = /(?:(\[((?:\\\]|[^\]])+)\]\[\s*?)([^\s\]]*?)\]|\[\s*?([^\s\]]*?)\])(?!\:)/g;

/**
 * Matches `<http://example.com>`
 * /
const autoLinkPattern = /\<(\w+:[^\>\s]+)\>/g;
*/

/**
 * Matches `[text]http://exemple.com`
 */
const definitionPattern = /^\[([^\]]+)\]((?:https?:\/\/|[.]{0,2}\/|#)\S+)(?:\s*(?=\n)|$)/gm;

/**
 * Matches `@text@`
 */
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
async function findCode(document: SkinnyTextDocument, engine: TextileEngine): Promise<CodeInDocument> {
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

function isLinkInsideCode(code: CodeInDocument, linkHrefRange: vscode.Range) {
	return code.multiline.some(interval => linkHrefRange.start.line >= interval[0] && linkHrefRange.start.line <= interval[1]) ||
		code.inline.some(position => position.intersection(linkHrefRange));
}
// -- End: Modified for textile


export class TextileLinkProvider implements vscode.DocumentLinkProvider {
	constructor(
		private readonly engine: TextileEngine
	) { }


	public async provideDocumentLinks(
		document: SkinnyTextDocument,
		token: vscode.CancellationToken
	): Promise<vscode.DocumentLink[]> {
		const allLinks = await this.getAllLinks(document);
		if (token.isCancellationRequested) {
			return [];
		}

		const definitionSet = new LinkDefinitionSet(allLinks);
		return coalesce(allLinks
			.map(data => this.toValidDocumentLink(data, definitionSet)));
	}

	// -- Begin: Modified for textile
	private toReferenceLink(link: TextileLink, definitionSet: LinkDefinitionSet): TextileLink {
		if (link.href.kind === 'internal') {
			const def = definitionSet.lookup(link.source.text);
			if (def) {
				return {
					kind: 'link',
					href: {
						kind: 'reference',
						ref: link.source.text,
					},
					source: link.source,
				};
			}
		}
		return link;
	}

	private toValidDocumentLink(link: TextileLink, definitionSet: LinkDefinitionSet): vscode.DocumentLink | undefined {
		switch (link.href.kind) {
			case 'external': {
				return new vscode.DocumentLink(link.source.hrefRange, link.href.uri);
			}
			case 'internal': {
				const uri = OpenDocumentLinkCommand.createCommandUri(link.source.resource, link.href.path, link.href.fragment);
				const documentLink = new vscode.DocumentLink(link.source.hrefRange, uri);
				documentLink.tooltip = localize('documentLink.tooltip', 'Follow link');
				return documentLink;
			}
			case 'reference': {
				const def = definitionSet.lookup(link.href.ref);
				if (def) {
					return new vscode.DocumentLink(
						link.source.hrefRange,
						vscode.Uri.parse(`command:_textile.moveCursorToPosition?${encodeURIComponent(JSON.stringify([def.source.hrefRange.start.line, def.source.hrefRange.start.character]))}`));
				} else {
					return undefined;
				}
			}
		}
	}

	public async getAllLinks(document: SkinnyTextDocument): Promise<TextileLink[]> {
		const codeInDocument = await findCode(document, this.engine);
		const allLinks = Array.from([
			...this.getInlineLinks(document, codeInDocument),
			// Disabled for Textile : ...this.getReferenceLinks(document, codeInDocument),
			...this.getLinkDefinitions2(document, codeInDocument),
			// FIXME for Textile : ...this.getAutoLinks(document, codeInDocument),
		]);
		const definitionSet = new LinkDefinitionSet(allLinks);
		return allLinks.map((link) => this.toReferenceLink(link, definitionSet));
	}

	private *getInlineLinks(document: SkinnyTextDocument, codeInDocument: CodeInDocument): Iterable<TextileLink> {
		const text = document.getText();
		for (const match of text.matchAll(linkPattern)) {
			const matchLink = match[1] && extractDocumentLink(document, match[1].length, match[3], match.index);
			if (matchLink && !isLinkInsideCode(codeInDocument, matchLink.source.hrefRange)) {
				yield matchLink;
			}
			const matchLinkFenced = match[6] && extractDocumentLink(document, match[4].length, match[6], match.index);
			if (matchLinkFenced && !isLinkInsideCode(codeInDocument, matchLinkFenced.source.hrefRange)) {
				yield matchLinkFenced;
			}
		}
		for (const match of text.matchAll(imagePattern)) {
			const matchImage = extractDocumentLink(document, (match[2] ? match[2].length : 0) + 1, match[3], match.index);
			if (matchImage && !isLinkInsideCode(codeInDocument, matchImage.source.hrefRange)) {
				yield matchImage;
			}
			const matchLink = match[5] && extractDocumentLink(document, match[1].length + 1, match[5], match.index);
			if (matchLink && !isLinkInsideCode(codeInDocument, matchLink.source.hrefRange)) {
				yield matchLink;
			}
		}
	}
	// -- End: Modified for textile

	/* Disabled : not relevant for textile
	private *getAutoLinks(document: SkinnyTextDocument, codeInDocument: CodeInDocument): Iterable<TextileLink> {
		const text = document.getText();

		for (const match of text.matchAll(autoLinkPattern)) {
			const link = match[1];
			const linkTarget = parseLink(document, link);
			if (linkTarget) {
				const offset = (match.index ?? 0) + 1;
				const linkStart = document.positionAt(offset);
				const linkEnd = document.positionAt(offset + link.length);
				const hrefRange = new vscode.Range(linkStart, linkEnd);
				if (isLinkInsideCode(codeInDocument, hrefRange)) {
					continue;
				}
				yield {
					kind: 'link',
					href: linkTarget,
					source: {
						text: link,
						resource: document.uri,
						hrefRange: new vscode.Range(linkStart, linkEnd),
						fragmentRange: getFragmentRange(link, linkStart, linkEnd),
					}
				};
			}
		}
	}

	private *getReferenceLinks(document: SkinnyTextDocument, codeInDocument: CodeInDocument): Iterable<TextileLink> {
		const text = document.getText();
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

			const hrefRange = new vscode.Range(linkStart, linkEnd);
			if (isLinkInsideCode(codeInDocument, hrefRange)) {
				continue;
			}


			yield {
				kind: 'link',
				source: {
					text: reference,
					resource: document.uri,
					hrefRange,
					fragmentRange: undefined,
				},
				href: {
					kind: 'reference',
					ref: reference,
				}
			};
		}
	}
	*/

	public async getLinkDefinitions(document: SkinnyTextDocument): Promise<Iterable<TextileLinkDefinition>> {
		const codeInDocument = await findCode(document, this.engine);
		return this.getLinkDefinitions2(document, codeInDocument);
	}

	private *getLinkDefinitions2(document: SkinnyTextDocument, codeInDocument: CodeInDocument): Iterable<TextileLinkDefinition> {
		const text = document.getText();
		for (const match of text.matchAll(definitionPattern)) {
			// -- Begin: Modified for textile
			const reference = match[1];
			const link = match[2].trim();
			const offset = (match.index || 0) + reference.length + 2;

			const refStart = document.positionAt((match.index ?? 0) + 1);
			const refRange = new vscode.Range(refStart, refStart.translate({ characterDelta: reference.length }));

			const linkStart = document.positionAt(offset);
			const linkEnd = document.positionAt(offset + link.length);

			const hrefRange = new vscode.Range(linkStart, linkEnd);
			if (isLinkInsideCode(codeInDocument, hrefRange)) {
				continue;
			}
			const target = parseLink(document, link);
			if (target) {
				yield {
					kind: 'definition',
					source: {
						text: link,
						resource: document.uri,
						hrefRange,
						fragmentRange: getFragmentRange(link, linkStart, linkEnd),
					},
					ref: { text: reference, range: refRange },
					href: target,
				};
			}
			// -- End: Modified for textile
		}
	}
}

export class LinkDefinitionSet {
	private readonly _map = new Map<string, TextileLinkDefinition>();

	constructor(links: Iterable<TextileLink>) {
		for (const link of links) {
			if (link.kind === 'definition') {
				this._map.set(link.ref.text, link);
			}
		}
	}

	public lookup(ref: string): TextileLinkDefinition | undefined {
		return this._map.get(ref);
	}
}
