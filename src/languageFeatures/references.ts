/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as uri from 'vscode-uri';
import { ILogger } from '../logging';
import { ITextileParser } from '../textileEngine';
import { TextileTableOfContentsProvider, TocEntry } from '../tableOfContents';
import { ITextDocument } from '../types/textDocument';
import { noopToken } from '../util/cancellation';
import { Disposable } from '../util/dispose';
import { looksLikeTextilePath } from '../util/file';
import { TextileWorkspaceInfoCache } from '../util/workspaceCache';
import { ITextileWorkspace } from '../workspace';
import { InternalHref, TextileLink, TextileLinkComputer } from './documentLinks';


/**
 * A link in a textile file.
 */
export interface TextileLinkReference {
	readonly kind: 'link';
	readonly isTriggerLocation: boolean;
	readonly isDefinition: boolean;
	readonly location: vscode.Location;

	readonly link: TextileLink;
}

/**
 * A header in a textile file.
 */
export interface TextileHeaderReference {
	readonly kind: 'header';

	readonly isTriggerLocation: boolean;
	readonly isDefinition: boolean;

	/**
	 * The range of the header.
	 *
	 * In `# a b c #` this would be the range of `# a b c #`
	 */
	readonly location: vscode.Location;

	/**
	 * The text of the header.
	 *
	 * In `# a b c #` this would be `a b c`
	 */
	readonly headerText: string;

	/**
	 * The range of the header text itself.
	 *
	 * In `# a b c #` this would be the range of `a b c`
	 */
	readonly headerTextLocation: vscode.Location;
}

export type TextileReference = TextileLinkReference | TextileHeaderReference;

/**
 * Stateful object that computes references for textile files.
 */
export class TextileReferencesProvider extends Disposable {

	private readonly _linkCache: TextileWorkspaceInfoCache<readonly TextileLink[]>;

	public constructor(
		private readonly parser: ITextileParser,
		private readonly workspace: ITextileWorkspace,
		private readonly tocProvider: TextileTableOfContentsProvider,
		private readonly logger: ILogger,
	) {
		super();

		const linkComputer = new TextileLinkComputer(parser);
		this._linkCache = this._register(new TextileWorkspaceInfoCache(workspace, doc => linkComputer.getAllLinks(doc, noopToken)));
	}

	public async getReferencesAtPosition(document: ITextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<TextileReference[]> {
		this.logger.verbose('ReferencesProvider', `getReferencesAtPosition: ${document.uri}`);

		const toc = await this.tocProvider.getForDocument(document);
		if (token.isCancellationRequested) {
			return [];
		}

		const header = toc.entries.find(entry => entry.line === position.line);
		if (header) {
			return this.getReferencesToHeader(document, header);
		} else {
			return this.getReferencesToLinkAtPosition(document, position, token);
		}
	}

	public async getReferencesToFileInWorkspace(resource: vscode.Uri, token: vscode.CancellationToken): Promise<TextileReference[]> {
		this.logger.verbose('ReferencesProvider', `getAllReferencesToFileInWorkspace: ${resource}`);

		const allLinksInWorkspace = (await this._linkCache.values()).flat();
		if (token.isCancellationRequested) {
			return [];
		}

		return Array.from(this.findLinksToFile(resource, allLinksInWorkspace, undefined));
	}

	public async getReferencesToFileInDocs(resource: vscode.Uri, otherDocs: readonly ITextDocument[], token: vscode.CancellationToken): Promise<TextileReference[]> {
		this.logger.verbose('ReferencesProvider', `getAllReferencesToFileInFiles: ${resource}`);

		const links = (await this._linkCache.getForDocs(otherDocs)).flat();
		if (token.isCancellationRequested) {
			return [];
		}

		return Array.from(this.findLinksToFile(resource, links, undefined));
	}

	private async getReferencesToHeader(document: ITextDocument, header: TocEntry): Promise<TextileReference[]> {
		const links = (await this._linkCache.values()).flat();

		const references: TextileReference[] = [];

		references.push({
			kind: 'header',
			isTriggerLocation: true,
			isDefinition: true,
			location: header.headerLocation,
			headerText: header.text,
			headerTextLocation: header.headerTextLocation
		});

		for (const link of links) {
			if (link.href.kind === 'internal'
				&& this.looksLikeLinkToDoc(link.href, document.uri)
				&& this.parser.slugifier.fromHeading(link.href.fragment).value === header.slug.value
			) {
				references.push({
					kind: 'link',
					isTriggerLocation: false,
					isDefinition: false,
					link,
					location: new vscode.Location(link.source.resource, link.source.hrefRange),
				});
			}
		}

		return references;
	}

	private async getReferencesToLinkAtPosition(document: ITextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<TextileReference[]> {
		const docLinks = (await this._linkCache.getForDocs([document]))[0];

		for (const link of docLinks) {
			if (link.kind === 'definition') {
				// We could be in either the ref name or the definition
				if (link.ref.range.contains(position)) {
					return Array.from(this.getReferencesToLinkReference(docLinks, link.ref.text, { resource: document.uri, range: link.ref.range }));
				} else if (link.source.hrefRange.contains(position)) {
					return this.getReferencesToLink(link, position, token);
				}
			} else {
				if (link.source.hrefRange.contains(position)) {
					return this.getReferencesToLink(link, position, token);
				}
			}
		}

		return [];
	}

	private async getReferencesToLink(sourceLink: TextileLink, triggerPosition: vscode.Position, token: vscode.CancellationToken): Promise<TextileReference[]> {
		const allLinksInWorkspace = (await this._linkCache.values()).flat();
		if (token.isCancellationRequested) {
			return [];
		}

		if (sourceLink.href.kind === 'reference') {
			return Array.from(this.getReferencesToLinkReference(allLinksInWorkspace, sourceLink.href.ref, { resource: sourceLink.source.resource, range: sourceLink.source.hrefRange }));
		}

		if (sourceLink.href.kind === 'external') {
			const references: TextileReference[] = [];

			for (const link of allLinksInWorkspace) {
				if (link.href.kind === 'external' && link.href.uri.toString() === sourceLink.href.uri.toString()) {
					const isTriggerLocation = sourceLink.source.resource.fsPath === link.source.resource.fsPath && sourceLink.source.hrefRange.isEqual(link.source.hrefRange);
					references.push({
						kind: 'link',
						isTriggerLocation,
						isDefinition: false,
						link,
						location: new vscode.Location(link.source.resource, link.source.hrefRange),
					});
				}
			}
			return references;
		}

		const resolvedResource = await tryResolveLinkPath(sourceLink.href.path, this.workspace);
		if (token.isCancellationRequested) {
			return [];
		}

		const references: TextileReference[] = [];

		if (resolvedResource && this.isTextilePath(resolvedResource) && sourceLink.href.fragment && sourceLink.source.fragmentRange?.contains(triggerPosition)) {
			const toc = await this.tocProvider.get(resolvedResource);
			const entry = toc.lookup(sourceLink.href.fragment);
			if (entry) {
				references.push({
					kind: 'header',
					isTriggerLocation: false,
					isDefinition: true,
					location: entry.headerLocation,
					headerText: entry.text,
					headerTextLocation: entry.headerTextLocation
				});
			}

			for (const link of allLinksInWorkspace) {
				if (link.href.kind !== 'internal' || !this.looksLikeLinkToDoc(link.href, resolvedResource)) {
					continue;
				}

				if (this.parser.slugifier.fromHeading(link.href.fragment).equals(this.parser.slugifier.fromHeading(sourceLink.href.fragment))) {
					const isTriggerLocation = sourceLink.source.resource.fsPath === link.source.resource.fsPath && sourceLink.source.hrefRange.isEqual(link.source.hrefRange);
					references.push({
						kind: 'link',
						isTriggerLocation,
						isDefinition: false,
						link,
						location: new vscode.Location(link.source.resource, link.source.hrefRange),
					});
				}
			}
		} else { // Triggered on a link without a fragment so we only require matching the file and ignore fragments
			references.push(...this.findLinksToFile(resolvedResource ?? sourceLink.href.path, allLinksInWorkspace, sourceLink));
		}

		return references;
	}

	private isTextilePath(resolvedHrefPath: vscode.Uri) {
		return this.workspace.hasTextileDocument(resolvedHrefPath) || looksLikeTextilePath(resolvedHrefPath);
	}

	private looksLikeLinkToDoc(href: InternalHref, targetDoc: vscode.Uri) {
		return href.path.fsPath === targetDoc.fsPath
			|| uri.Utils.extname(href.path) === '' && href.path.with({ path: href.path.path + '.textile' }).fsPath === targetDoc.fsPath;
	}

	private *findLinksToFile(resource: vscode.Uri, links: readonly TextileLink[], sourceLink: TextileLink | undefined): Iterable<TextileReference> {
		for (const link of links) {
			if (link.href.kind !== 'internal' || !this.looksLikeLinkToDoc(link.href, resource)) {
				continue;
			}

			// Exclude cases where the file is implicitly referencing itself
			if (link.source.hrefText.startsWith('#') && link.source.resource.fsPath === resource.fsPath) {
				continue;
			}

			const isTriggerLocation = !!sourceLink && sourceLink.source.resource.fsPath === link.source.resource.fsPath && sourceLink.source.hrefRange.isEqual(link.source.hrefRange);
			const pathRange = this.getPathRange(link);
			yield {
				kind: 'link',
				isTriggerLocation,
				isDefinition: false,
				link,
				location: new vscode.Location(link.source.resource, pathRange),
			};
		}
	}

	private *getReferencesToLinkReference(allLinks: Iterable<TextileLink>, refToFind: string, from: { resource: vscode.Uri; range: vscode.Range }): Iterable<TextileReference> {
		for (const link of allLinks) {
			let ref: string;
			if (link.kind === 'definition') {
				ref = link.ref.text;
			} else if (link.href.kind === 'reference') {
				ref = link.href.ref;
			} else {
				continue;
			}

			if (ref === refToFind && link.source.resource.fsPath === from.resource.fsPath) {
				const isTriggerLocation = from.resource.fsPath === link.source.resource.fsPath && (
					(link.href.kind === 'reference' && from.range.isEqual(link.source.hrefRange)) || (link.kind === 'definition' && from.range.isEqual(link.ref.range)));

				const pathRange = this.getPathRange(link);
				yield {
					kind: 'link',
					isTriggerLocation,
					isDefinition: link.kind === 'definition',
					link,
					location: new vscode.Location(from.resource, pathRange),
				};
			}
		}
	}

	/**
	 * Get just the range of the file path, dropping the fragment
	 */
	private getPathRange(link: TextileLink): vscode.Range {
		return link.source.fragmentRange
			? link.source.hrefRange.with(undefined, link.source.fragmentRange.start.translate(0, -1))
			: link.source.hrefRange;
	}
}

/**
 * Implements {@link vscode.ReferenceProvider} for textile documents.
 */
export class TextileVsCodeReferencesProvider implements vscode.ReferenceProvider {

	public constructor(
		private readonly referencesProvider: TextileReferencesProvider
	) { }

	async provideReferences(document: ITextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): Promise<vscode.Location[]> {
		const allRefs = await this.referencesProvider.getReferencesAtPosition(document, position, token);
		return allRefs
			.filter(ref => context.includeDeclaration || !ref.isDefinition)
			.map(ref => ref.location);
	}
}

export function registerReferencesSupport(
	selector: vscode.DocumentSelector,
	referencesProvider: TextileReferencesProvider,
): vscode.Disposable {
	return vscode.languages.registerReferenceProvider(selector, new TextileVsCodeReferencesProvider(referencesProvider));
}

export async function tryResolveLinkPath(originalUri: vscode.Uri, workspace: ITextileWorkspace): Promise<vscode.Uri | undefined> {
	if (await workspace.pathExists(originalUri)) {
		return originalUri;
	}

	// We don't think the file exists. If it doesn't already have an extension, try tacking on a `.textile` and using that instead
	if (uri.Utils.extname(originalUri) === '') {
		const dotTextileResource = originalUri.with({ path: originalUri.path + '.textile' });
		if (await workspace.pathExists(dotTextileResource)) {
			return dotTextileResource;
		}
	}

	return undefined;
}
