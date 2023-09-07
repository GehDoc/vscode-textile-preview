/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as uri from 'vscode-uri';
import { TextileEngine } from '../textileEngine';
import { Slugifier } from '../slugify';
import { TableOfContents, TocEntry } from '../tableOfContents';
import { noopToken } from '../util/cancellation';
import { Disposable } from '../util/dispose';
import { TextileWorkspaceContents, SkinnyTextDocument } from '../workspaceContents';
import { InternalHref, TextileLink, TextileLinkProvider } from './documentLinkProvider';
import { TextileWorkspaceCache } from './workspaceCache';


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

export class TextileReferencesProvider extends Disposable implements vscode.ReferenceProvider {

	private readonly _linkCache: TextileWorkspaceCache<readonly TextileLink[]>;

	public constructor(
		private readonly linkProvider: TextileLinkProvider,
		private readonly workspaceContents: TextileWorkspaceContents,
		private readonly engine: TextileEngine,
		private readonly slugifier: Slugifier,
	) {
		super();

		this._linkCache = this._register(new TextileWorkspaceCache(workspaceContents, doc => linkProvider.getAllLinks(doc, noopToken)));
	}

	async provideReferences(document: SkinnyTextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): Promise<vscode.Location[] | undefined> {
		const allRefs = await this.getAllReferencesAtPosition(document, position, token);

		return allRefs
			.filter(ref => context.includeDeclaration || !ref.isDefinition)
			.map(ref => ref.location);
	}

	public async getAllReferencesAtPosition(document: SkinnyTextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<TextileReference[]> {
		const toc = await TableOfContents.create(this.engine, document);
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

	private async getReferencesToHeader(document: SkinnyTextDocument, header: TocEntry): Promise<TextileReference[]> {
		const links = (await this._linkCache.getAll()).flat();

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
				&& this.slugifier.fromHeading(link.href.fragment).value === header.slug.value
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

	private async getReferencesToLinkAtPosition(document: SkinnyTextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<TextileReference[]> {
		const docLinks = await this.linkProvider.getAllLinks(document, token);

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
		const allLinksInWorkspace = (await this._linkCache.getAll()).flat();
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

		const targetDoc = await tryFindTextileDocumentForLink(sourceLink.href, this.workspaceContents);
		if (token.isCancellationRequested) {
			return [];
		}

		const references: TextileReference[] = [];

		if (targetDoc && sourceLink.href.fragment && sourceLink.source.fragmentRange?.contains(triggerPosition)) {
			const toc = await TableOfContents.create(this.engine, targetDoc);
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
				if (link.href.kind !== 'internal' || !this.looksLikeLinkToDoc(link.href, targetDoc.uri)) {
					continue;
				}

				if (this.slugifier.fromHeading(link.href.fragment).equals(this.slugifier.fromHeading(sourceLink.href.fragment))) {
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
			references.push(...this.findAllLinksToFile(targetDoc?.uri ?? sourceLink.href.path, allLinksInWorkspace, sourceLink));
		}

		return references;
	}

	private looksLikeLinkToDoc(href: InternalHref, targetDoc: vscode.Uri) {
		return href.path.fsPath === targetDoc.fsPath
			|| uri.Utils.extname(href.path) === '' && href.path.with({ path: href.path.path + '.textile' }).fsPath === targetDoc.fsPath;
	}

	public async getAllReferencesToFile(resource: vscode.Uri, _token: vscode.CancellationToken): Promise<TextileReference[]> {
		const allLinksInWorkspace = (await this._linkCache.getAll()).flat();
		return Array.from(this.findAllLinksToFile(resource, allLinksInWorkspace, undefined));
	}

	private * findAllLinksToFile(resource: vscode.Uri, allLinksInWorkspace: readonly TextileLink[], sourceLink: TextileLink | undefined): Iterable<TextileReference> {
		for (const link of allLinksInWorkspace) {
			if (link.href.kind !== 'internal' || !this.looksLikeLinkToDoc(link.href, resource)) {
				continue;
			}

			// Exclude cases where the file is implicitly referencing itself
			if (link.source.text.startsWith('#') && link.source.resource.fsPath === resource.fsPath) {
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

	private * getReferencesToLinkReference(allLinks: Iterable<TextileLink>, refToFind: string, from: { resource: vscode.Uri; range: vscode.Range }): Iterable<TextileReference> {
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

export async function tryFindTextileDocumentForLink(href: InternalHref, workspaceContents: TextileWorkspaceContents): Promise<SkinnyTextDocument | undefined> {
	const targetDoc = await workspaceContents.getTextileDocument(href.path);
	if (targetDoc) {
		return targetDoc;
	}

	// We don't think the file exists. If it doesn't already have an extension, try tacking on a `.textile` and using that instead
	if (uri.Utils.extname(href.path) === '') {
		const dotTextileResource = href.path.with({ path: href.path.path + '.textile' });
		return workspaceContents.getTextileDocument(dotTextileResource);
	}

	return undefined;
}

