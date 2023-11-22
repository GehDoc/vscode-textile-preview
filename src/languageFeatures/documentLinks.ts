/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as uri from 'vscode-uri';
import { OpenDocumentLinkCommand } from '../commands/openDocumentLink';
import { ILogger } from '../logging';
import { Token } from '../../libs/textile-js/textile';
import { ITextileParser, getLineNumber, getEndLineNumber } from '../textileEngine';
import { ITextDocument } from '../types/textDocument';
import { coalesce } from '../util/arrays';
import { noopToken } from '../util/cancellation';
import { Disposable } from '../util/dispose';
import { getUriForLinkWithKnownExternalScheme, isOfScheme, Schemes } from '../util/schemes';
import { TextileDocumentInfoCache } from '../util/workspaceCache';
import { ITextileWorkspace } from '../workspace';

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


function resolveLink(
	document: ITextDocument,
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

	if (/^[a-z\-][a-z\-]+:/i.test(link)) {
		// Looks like a uri
		return { kind: 'external', uri: vscode.Uri.parse(link) };
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

	// If we are in a notebook cell, resolve relative to notebook instead
	if (resourceUri.scheme === Schemes.notebookCell) {
		const notebook = vscode.workspace.notebookDocuments
			.find(notebook => notebook.getCells().some(cell => cell.document === document));

		if (notebook) {
			resourceUri = resourceUri.with({ scheme: notebook.uri.scheme });
		}
	}

	return {
		kind: 'internal',
		path: resourceUri.with({ fragment: '' }),
		fragment: tempUri.fragment,
	};
}

function getWorkspaceFolder(document: ITextDocument) {
	return vscode.workspace.getWorkspaceFolder(document.uri)?.uri
		|| vscode.workspace.workspaceFolders?.[0]?.uri;
}

export interface TextileLinkSource {
	/**
	 * The full range of the link.
	 */
	readonly range: vscode.Range;

	/**
	 * The file where the link is defined.
	 */
	readonly resource: vscode.Uri;

	/**
	 * The original text of the link destination in code.
	 */
	readonly hrefText: string;

	/**
	 * The original text of just the link's path in code.
	 */
	readonly pathText: string;

	/**
	 * The range of the path.
	 */
	readonly hrefRange: vscode.Range;

	/**
	 * The range of the fragment within the path.
	 */
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
	document: ITextDocument,
	pre: number, // Modified for Textile
	rawLink: string,
	matchIndex: number,
	fullMatch: string,
): TextileLink | undefined {
	const isAngleBracketLink = false; // Disabled for Textile : no relevant
	const link = rawLink; // Disabled for Textile : no relevant

	let linkTarget: ExternalHref | InternalHref | undefined;
	try {
		linkTarget = resolveLink(document, link);
	} catch {
		return undefined;
	}
	if (!linkTarget) {
		return undefined;
	}

	const linkStart = document.positionAt(matchIndex);
	const linkEnd = linkStart.translate(0, fullMatch.length);
	const hrefStart = linkStart.translate(0, pre + (isAngleBracketLink ? 1 : 0));
	const hrefEnd = hrefStart.translate(0, link.length);
	return {
		kind: 'link',
		href: linkTarget,
		source: {
			hrefText: link,
			resource: document.uri,
			range: new vscode.Range(linkStart, linkEnd),
			hrefRange: new vscode.Range(hrefStart, hrefEnd),
			...getLinkSourceFragmentInfo(document, link, hrefStart, hrefEnd),
		}
	};
}

function getFragmentRange(text: string, start: vscode.Position, end: vscode.Position): vscode.Range | undefined {
	const index = text.indexOf('#');
	if (index < 0) {
		return undefined;
	}
	return new vscode.Range(start.translate({ characterDelta: index + 1 }), end);
}

function getLinkSourceFragmentInfo(document: ITextDocument, link: string, linkStart: vscode.Position, linkEnd: vscode.Position): { fragmentRange: vscode.Range | undefined; pathText: string } {
	const fragmentRange = getFragmentRange(link, linkStart, linkEnd);
	return {
		pathText: document.getText(new vscode.Range(linkStart, fragmentRange ? fragmentRange.start.translate(0, -1) : linkEnd)),
		fragmentRange,
	};
}

/* Disabled for textile
const angleBracketLinkRe = /^<(.*)>$/;

/**
 * Used to strip brackets from the textile link
 *
 * <http://example.com> will be transformed to http://example.com
* /
function stripAngleBrackets(link: string) {
	return link.replace(angleBracketLinkRe, '$1');
}
*/

// -- Begin: Modified for textile

/**
 * Matches `"text":link`
 * Disabled, not relevant for Textile : link in angletbrackets
 */
const linkPattern = /("(?!\s)((?:[^"]|"(?![\s:])[^\n"]+"(?!:))+)":)((?:[^\s()]|\([^\s()]+\)|[()])+?)(?=[!-\.:-@\[\\\]-`{-~]+(?:$|\s)|$|\s)|(\["([^\n]+?)":)((?:\[[a-z0-9]*\]|[^\]])+)\]/g

/**
 * Matches `!url(alt)!`
 */
const imagePattern = /(!(?!\s)((?:\([^\)]+\)|\{[^\}]+\}|\\[[^\[\]]+\]|(?:<>|<|>|=)|[\(\)]+)*(?:\.[^\n\S]|\.(?:[^\.\/]))?)([^!\s]+?) ?(?:\(((?:[^\(\)]|\([^\(\)]+\))+)\))?!)(?::([^\s]+?(?=[!-\.:-@\[\\\]-`{-~](?:$|\s)|\s|$)))?/g

/* Disabled : not relevant for textile
/**
 * Matches `[text][ref]` or `[shorthand]`
 * /
const referenceLinkPattern = /(^|[^\]\\])(?:(?:(\[((?:\\\]|[^\]])+)\]\[\s*?)([^\s\]]*?)\]|\[\s*?([^\s\]]*?)\])(?![\:\(]))/gm;

/**
 * Matches `<http://example.com>`
 * /
const autoLinkPattern = /\<(\w+:[^\>\s]+)\>/g;
*/

/**
 * Matches `[text]http://exemple.com`
 */
const definitionPattern = /^(\[([^\]]+)\])((?:https?:\/\/|[.]{0,2}\/|#)\S+)(?:\s*(?=\n)|$)/gm;

/**
 * Matches `@text@`
 */
const inlineCodePattern = /(?:^|[^@])(@+)(?:.+?|.*?(?:(?:\r?\n).+?)*?)(?:\r?\n)?\1(?:$|[^@])/gm;
// -- End: Modified for textile

// -- Begin: Modified for textile
class NoLinkRanges {
	public static async compute(tokenizer: ITextileParser, document: ITextDocument): Promise<NoLinkRanges> {
		const tokens = await tokenizer.tokenize(document);
		const jsonmlUtils = await tokenizer.jsonmlUtils();
		const multiline = [] as [number, number][]
		jsonmlUtils.applyHooks(tokens, [
			[(token : Token) => {
				if (!!token.map && (token[0] === 'code' || token[0] === 'pre' || token[0] === '!')) {
					const startLine = getLineNumber(token)
					const endLine = getEndLineNumber(token)
					if(startLine !== undefined && endLine !== undefined)
						multiline.push([startLine, endLine])
				}
				return token;
			}]
		]);

		const inlineRanges = new Map</* line number */ number, vscode.Range[]>();
		const text = document.getText();
		for (const match of text.matchAll(inlineCodePattern)) {
			const startOffset = match.index ?? 0;
			const startPosition = document.positionAt(startOffset);

			const range = new vscode.Range(startPosition, document.positionAt(startOffset + match[0].length));
			for (let line = range.start.line; line <= range.end.line; ++line) {
				let entry = inlineRanges.get(line);
				if (!entry) {
					entry = [];
					inlineRanges.set(line, entry);
				}
				entry.push(range);
			}
		}

		return new NoLinkRanges(multiline, inlineRanges);
	}

	private constructor(
		/**
		 * code blocks and fences each represented by [line_start,line_end).
		 */
		public readonly multiline: ReadonlyArray<[number, number]>,

		/**
		 * Inline code spans where links should not be detected
		 */
		public readonly inline: Map</* line number */ number, vscode.Range[]>
	) { }

	contains(position: vscode.Position): boolean {
		return this.multiline.some(interval => position.line >= interval[0] && position.line <= interval[1]) ||
			!!this.inline.get(position.line)?.some(inlineRange => inlineRange.contains(position));
	}

	concatInline(inlineRanges: Iterable<vscode.Range>): NoLinkRanges {
		const newInline = new Map(this.inline);
		for (const range of inlineRanges) {
			for (let line = range.start.line; line <= range.end.line; ++line) {
				let entry = newInline.get(line);
				if (!entry) {
					entry = [];
					newInline.set(line, entry);
				}
				entry.push(range);
			}
		}
		return new NoLinkRanges(this.multiline, newInline);
	}
}
// -- End: Modified for textile

/**
 * Stateless object that extracts link information from textile files.
 */
export class TextileLinkComputer {

	constructor(
		private readonly tokenizer: ITextileParser,
	) { }

	// -- Begin: Modified for textile
	private toReferenceLink(link: TextileLink, definitionSet: LinkDefinitionSet): TextileLink {
		if (link.href.kind === 'internal') {
			const def = definitionSet.lookup(link.source.hrefText);
			if (def) {
				return {
					kind: 'link',
					href: {
						kind: 'reference',
						ref: link.source.hrefText,
					},
					source: link.source,
				};
			}
		}
		return link;
	}

	public async getAllLinks(document: ITextDocument, token: vscode.CancellationToken): Promise<TextileLink[]> {
		const noLinkRanges = await NoLinkRanges.compute(this.tokenizer, document);
		if (token.isCancellationRequested) {
			return [];
		}

		const inlineLinks = Array.from(this.getInlineLinks(document, noLinkRanges));
		const allLinks = Array.from([
			...inlineLinks,
			// Disabled for Textile : ...this.getReferenceLinks(document, noLinkRanges.concatInline(inlineLinks.map(x => x.source.range))),
			...this.getLinkDefinitions(document, noLinkRanges),
			// FIXME for Textile : ...this.getAutoLinks(document, noLinkRanges),
		]);
		const definitionSet = new LinkDefinitionSet(allLinks);
		return allLinks.map((link) => this.toReferenceLink(link, definitionSet));
	}

	private *getInlineLinks(document: ITextDocument, noLinkRanges: NoLinkRanges): Iterable<TextileLink> {
		const text = document.getText();
		for (const match of text.matchAll(linkPattern)) {
			const matchLink = match[1] && extractDocumentLink(document, match[1].length, match[3], match.index ?? 0, match[0]);
			if (matchLink && !noLinkRanges.contains(matchLink.source.hrefRange.start)) {
				yield matchLink;
			}
			const matchLinkFenced = match[6] && extractDocumentLink(document, match[4].length, match[6], match.index ?? 0, match[0]);
			if (matchLinkFenced && !noLinkRanges.contains(matchLinkFenced.source.hrefRange.start)) {
				yield matchLinkFenced;
			}
		}
		for (const match of text.matchAll(imagePattern)) {
			const matchImage = extractDocumentLink(document, (match[2] ? match[2].length : 0) + 1, match[3], match.index ?? 0, match[0]);
			if (matchImage && !noLinkRanges.contains(matchImage.source.hrefRange.start)) {
				yield matchImage;
			}
			const matchLink = match[5] && extractDocumentLink(document, match[1].length + 1, match[5], match.index ?? 0, match[0]);
			if (matchLink && !noLinkRanges.contains(matchLink.source.hrefRange.start)) {
				yield matchLink;
			}
		}
	}
	// -- End: Modified for textile

	/* Disabled : not relevant for textile
	private *getAutoLinks(document: ITextDocument, noLinkRanges: NoLinkRanges): Iterable<TextileLink> {
		const text = document.getText();
		for (const match of text.matchAll(autoLinkPattern)) {
			const linkOffset = (match.index ?? 0);
			const linkStart = document.positionAt(linkOffset);
			if (noLinkRanges.contains(linkStart)) {
				continue;
			}

			const link = match[1];
			const linkTarget = resolveLink(document, link);
			if (!linkTarget) {
				continue;
			}

			const linkEnd = linkStart.translate(0, match[0].length);
			const hrefStart = linkStart.translate(0, 1);
			const hrefEnd = hrefStart.translate(0, link.length);
			yield {
				kind: 'link',
				href: linkTarget,
				source: {
					hrefText: link,
					resource: document.uri,
					hrefRange: new vscode.Range(hrefStart, hrefEnd),
					range: new vscode.Range(linkStart, linkEnd),
					...getLinkSourceFragmentInfo(document, link, hrefStart, hrefEnd),
				}
			};
		}
	}

	private *getReferenceLinks(document: ITextDocument, noLinkRanges: NoLinkRanges): Iterable<TextileLink> {
		const text = document.getText();
		for (const match of text.matchAll(referenceLinkPattern)) {
			const linkStart = document.positionAt(match.index ?? 0);
			if (noLinkRanges.contains(linkStart)) {
				continue;
			}

			let hrefStart: vscode.Position;
			let hrefEnd: vscode.Position;
			let reference = match[4];
			if (reference === '') { // [ref][],
				reference = match[3];
				const offset = ((match.index ?? 0) + match[1].length) + 1;
				hrefStart = document.positionAt(offset);
				hrefEnd = document.positionAt(offset + reference.length);
			} else if (reference) { // [text][ref]
				const pre = match[2];
				const offset = ((match.index ?? 0) + match[1].length) + pre.length;
				hrefStart = document.positionAt(offset);
				hrefEnd = document.positionAt(offset + reference.length);
			} else if (match[5]) { // [ref]
				reference = match[5];
				const offset = ((match.index ?? 0) + match[1].length) + 1;
				hrefStart = document.positionAt(offset);
				const line = document.lineAt(hrefStart.line);
				// See if link looks like a checkbox
				const checkboxMatch = line.text.match(/^\s*[\-\*]\s*\[x\]/i);
				if (checkboxMatch && hrefStart.character <= checkboxMatch[0].length) {
					continue;
				}
				hrefEnd = document.positionAt(offset + reference.length);
			} else {
				continue;
			}

			const linkEnd = linkStart.translate(0, match[0].length);
			yield {
				kind: 'link',
				source: {
					hrefText: reference,
					pathText: reference,
					resource: document.uri,
					range: new vscode.Range(linkStart, linkEnd),
					hrefRange: new vscode.Range(hrefStart, hrefEnd),
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

	private *getLinkDefinitions(document: ITextDocument, noLinkRanges: NoLinkRanges): Iterable<TextileLinkDefinition> {
		const text = document.getText();
		for (const match of text.matchAll(definitionPattern)) {
			const offset = (match.index ?? 0);
			const linkStart = document.positionAt(offset);
			if (noLinkRanges.contains(linkStart)) {
				continue;
			}

			const pre = match[1];
			const reference = match[2];
			const rawLinkText = match[3].trim();
			const target = resolveLink(document, rawLinkText);
			if (!target) {
				continue;
			}

			const isAngleBracketLink = false; // Disabled for Textile : not relevant
			const linkText = rawLinkText; // Disabled for Textile : not relevant
			const hrefStart = linkStart.translate(0, pre.length + (isAngleBracketLink ? 1 : 0));
			const hrefEnd = hrefStart.translate(0, linkText.length);
			const hrefRange = new vscode.Range(hrefStart, hrefEnd);

			const refStart = linkStart.translate(0, 1);
			const refRange = new vscode.Range(refStart, refStart.translate({ characterDelta: reference.length }));
			const linkEnd = linkStart.translate(0, match[0].length);
			yield {
				kind: 'definition',
				source: {
					hrefText: linkText,
					resource: document.uri,
					range: new vscode.Range(linkStart, linkEnd),
					hrefRange,
					...getLinkSourceFragmentInfo(document, rawLinkText, hrefStart, hrefEnd),
				},
				ref: { text: reference, range: refRange },
				href: target,
			};
		}
	}
}

interface TextileDocumentLinks {
	readonly links: readonly TextileLink[];
	readonly definitions: LinkDefinitionSet;
}

/**
 * Stateful object which provides links for textile files the workspace.
 */
export class TextileLinkProvider extends Disposable {

	private readonly _linkCache: TextileDocumentInfoCache<TextileDocumentLinks>;

	private readonly linkComputer: TextileLinkComputer;

	constructor(
		tokenizer: ITextileParser,
		workspace: ITextileWorkspace,
		logger: ILogger,
	) {
		super();
		this.linkComputer = new TextileLinkComputer(tokenizer);
		this._linkCache = this._register(new TextileDocumentInfoCache(workspace, async doc => {
			logger.verbose('LinkProvider', `compute - ${doc.uri}`);

			const links = await this.linkComputer.getAllLinks(doc, noopToken);
			return {
				links,
				definitions: new LinkDefinitionSet(links),
			};
		}));
	}

	public async getLinks(document: ITextDocument): Promise<TextileDocumentLinks> {
		return this._linkCache.getForDocument(document);
	}
}

export class LinkDefinitionSet implements Iterable<[string, TextileLinkDefinition]> {
	private readonly _map = new Map<string, TextileLinkDefinition>();

	constructor(links: Iterable<TextileLink>) {
		for (const link of links) {
			if (link.kind === 'definition') {
				this._map.set(link.ref.text, link);
			}
		}
	}

	public [Symbol.iterator](): Iterator<[string, TextileLinkDefinition]> {
		return this._map.entries();
	}

	public lookup(ref: string): TextileLinkDefinition | undefined {
		return this._map.get(ref);
	}
}

export class TextileVsCodeLinkProvider implements vscode.DocumentLinkProvider {

	constructor(
		private readonly _linkProvider: TextileLinkProvider,
	) { }

	public async provideDocumentLinks(
		document: ITextDocument,
		token: vscode.CancellationToken
	): Promise<vscode.DocumentLink[]> {
		const { links, definitions } = await this._linkProvider.getLinks(document);
		if (token.isCancellationRequested) {
			return [];
		}

		return coalesce(links.map(data => this.toValidDocumentLink(data, definitions)));
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
				// We only render reference links in the editor if they are actually defined.
				// This matches how reference links are rendered by textile-it.
				const def = definitionSet.lookup(link.href.ref);
				if (def) {
					const documentLink = new vscode.DocumentLink(
						link.source.hrefRange,
						vscode.Uri.parse(`command:_textile.moveCursorToPosition?${encodeURIComponent(JSON.stringify([def.source.hrefRange.start.line, def.source.hrefRange.start.character]))}`));
					documentLink.tooltip = localize('documentLink.referenceTooltip', 'Go to link definition');
					return documentLink;
				} else {
					return undefined;
				}
			}
		}
	}
}

export function registerDocumentLinkSupport(
	selector: vscode.DocumentSelector,
	linkProvider: TextileLinkProvider,
): vscode.Disposable {
	return vscode.languages.registerDocumentLinkProvider(selector, new TextileVsCodeLinkProvider(linkProvider));
}
