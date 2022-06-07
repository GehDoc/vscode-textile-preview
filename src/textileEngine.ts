/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextileJS, Token, Options as TextileJSConfig } from '../libs/textile-js/textile';
//import Token = require('textile-it/lib/token');
import * as vscode from 'vscode';
import { TextileContributionProvider as TextileContributionProvider } from './textileExtensions';
import { Slugifier } from './slugify';
import { SkinnyTextDocument } from './tableOfContentsProvider';
import { hash } from './util/hash';
import { isOfScheme, Schemes } from './util/links';
import { WebviewResourceProvider } from './util/resources';

const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;

/* Disabled for textile : already defined in textile lib
/**
 * Adds begin line index to the output via the 'data-line' data attribute.
 * /
const pluginSourceMap: TextileJS.PluginSimple = (md): void => {
	// Set the attribute on every possible token.
	md.core.ruler.push('source_map_data_attribute', (state): void => {
		for (const token of state.tokens) {
			if (token.map && token.type !== 'inline') {
				token.attrSet('data-line', String(token.map[0]));
				token.attrJoin('class', 'code-line');
			}
		}
	});

	// The 'html_block' renderer doesn't respect `attrs`. We need to insert a marker.
	const originalHtmlBlockRenderer = md.renderer.rules['html_block'];
	if (originalHtmlBlockRenderer) {
		md.renderer.rules['html_block'] = (tokens, idx, options, env, self) => (
			`<div ${self.renderAttrs(tokens[idx])} ></div>\n` +
			originalHtmlBlockRenderer(tokens, idx, options, env, self)
		);
	}
};

/**
 * The textile-it options that we expose in the settings.
 * /
type TextileJSConfig = Readonly<Required<Pick<TextileJS.Options, 'breaks' | 'linkify' | 'typographer'>>>;
*/

class TokenCache {
	private cachedDocument?: {
		readonly uri: vscode.Uri;
		readonly version: number;
		readonly config: TextileJSConfig;
	};
	private tokens?: Token[];

	public tryGetCached(document: SkinnyTextDocument, config: TextileJSConfig): Token[] | undefined {
		if (this.cachedDocument
			&& this.cachedDocument.uri.toString() === document.uri.toString()
			&& this.cachedDocument.version === document.version
			&& this.cachedDocument.config.breaks === config.breaks
			/* Disabled for Textile : && this.cachedDocument.config.linkify === config.linkify */
		) {
			return this.tokens;
		}
		return undefined;
	}

	public update(document: SkinnyTextDocument, config: TextileJSConfig, tokens: Token[]) {
		this.cachedDocument = {
			uri: document.uri,
			version: document.version,
			config,
		};
		this.tokens = tokens;
	}

	public clean(): void {
		this.cachedDocument = undefined;
		this.tokens = undefined;
	}
}

const FrontMatterRegex = /^---\s*[^]*?(-{3}|\.{3})\s*/; // Keep for Textile

export interface RenderOutput {
	html: string;
	containingImages: { src: string }[];
}

interface RenderEnv {
	containingImages: { src: string }[];
	currentDocument: vscode.Uri | undefined;
	resourceProvider: WebviewResourceProvider | undefined;
}

export class TextileEngine {

	private textile?: Promise<TextileJS>;

	private _slugCount = new Map<string, number>();
	private _tokenCache = new TokenCache();

	public constructor(
		/* Disabled for textile : private */ readonly contributionProvider: TextileContributionProvider,
		private readonly slugifier: Slugifier,
	) {
		contributionProvider.onContributionsChanged(() => {
			// Textile plugin contributions may have changed
			this.textile = undefined;
		});
	}

	private async getEngine(config: TextileJSConfig): Promise<TextileJS> {
		if (!this.textile) {
			this.textile = (async () => {
				const textile = await import('../libs/textile-js/textile');
				/* -- Begin : changed for Textile :
				let md: TextileJS = textileIt(await getTextileOptions(() => md));
				md.linkify.set({ fuzzyLink: false });

				for (const plugin of this.contributionProvider.contributions.textileItPlugins.values()) {
					try {
						md = (await plugin)(md);
					} catch (e) {
						console.error('Could not load textile it plugin', e);
					}
				}

				const frontMatterPlugin = await import('textile-it-front-matter');
				// Extract rules from front matter plugin and apply at a lower precedence
				let fontMatterRule: any;
				frontMatterPlugin({
					block: {
						ruler: {
							before: (_id: any, _id2: any, rule: any) => { fontMatterRule = rule; }
						}
					}
				}, () => { /* noop * / });

				md.block.ruler.before('fence', 'front_matter', fontMatterRule, {
					alt: ['paragraph', 'reference', 'blockquote', 'list']
				});

				*/

				// hooks are set only once : don't add them to config member parameter
				const localConfig :TextileJSConfig = {
					hooks: [],
					renderers: []
				};
				this.addImageRenderer(textile, localConfig);
				this.addFencedRenderer(textile, localConfig);
				// FIXME ? this.addLinkNormalizer(md);
				// FIXME ? this.addLinkValidator(md);
				this.addNamedHeaders(textile, localConfig);
				this.addLinkRenderer(textile, localConfig);
				textile.setOptions( localConfig );
				// -- End : changed for textile

				return textile;
			})();
		}

		const textile = await this.textile!;
		textile.setOptions(config); // Changed for texile
		return textile;
	}

	public reloadPlugins() {
		this.textile = undefined;
	}

	// -- Begin: Keep for Textile
	private stripFrontmatter(text: string): { text: string, offset: number } {
		let offset = 0;
		const frontMatterMatch = FrontMatterRegex.exec(text);
		if (frontMatterMatch) {
			const frontMatter = frontMatterMatch[0];
			offset = frontMatter.split(/\r\n|\n|\r/g).length - 1;
			text = text.substr(frontMatter.length);
		}
		return { text, offset };
	}
	// -- End: Keep for Textile

	// -- Begin: Added for Textile
	public async jsonmlUtils() :Promise<TextileJS["jsonmlUtils"]> {
		return (await this.textile!).jsonmlUtils;
	}

	private reduceTokenString(jsonml: Token[]) :string {
		let res = '';
		for( let i = 1, l = jsonml.length; i < l; i++) {
			if (typeof( jsonml[i] ) === 'string') {
				res += jsonml[i];
			} else if (Array.isArray(jsonml[i])) {
				res += this.reduceTokenString(jsonml[i]);
			}
		}
		return res;
	}
	// -- End: Added for Textile

	// -- Begin : Modified for textile
	private tokenizeDocument(
		document: SkinnyTextDocument,
		config: TextileJSConfig,
		engine: TextileJS,
		env?: RenderEnv
	): Token[] {
		const cached = this._tokenCache.tryGetCached(document, config);
		if (cached) {
			return cached;
		}

		const tokens = this.tokenizeString(document.getText(), engine, env);
		this._tokenCache.update(document, config, tokens);
		return tokens;
	}

	private tokenizeString(text: string, engine: TextileJS, env?: RenderEnv) {
		this._slugCount = new Map<string, number>();

		// Now, always strip frontMatter
		const textileContent = this.stripFrontmatter(text);
		
		return engine.tokenize(textileContent.text.replace(UNICODE_NEWLINE_REGEX, ''), {
			lineOffset: textileContent.offset
		}, env);
	}

	public async render(input: SkinnyTextDocument | string, resourceProvider?: WebviewResourceProvider): Promise<RenderOutput> {
		const config = this.getConfig(typeof input === 'string' ? undefined : input.uri);
		const engine = await this.getEngine(config);

		const env: RenderEnv = {
			containingImages: [],
			currentDocument: typeof input === 'string' ? undefined : input.uri,
			resourceProvider,
		};

		const tokens = typeof input === 'string'
			? this.tokenizeString(input, engine, env)
			: this.tokenizeDocument(input, config, engine, env);

		// -- Begin: Changed for Textile
		const html = tokens.map( ( value ) => engine.serialize( value, config, env ) ).join('');
		// -- End: Changed for Textile

		return {
			html,
			containingImages: env.containingImages
		};
	}
	// -- End : Modified for textile

	public async parse(document: SkinnyTextDocument, env?: RenderEnv): Promise<Token[]> {
		const config = this.getConfig(document.uri);
		const engine = await this.getEngine(config);
		return this.tokenizeDocument(document, config, engine, env);
	}

	public cleanCache(): void {
		this._tokenCache.clean();
	}

	private getConfig(resource?: vscode.Uri): TextileJSConfig {
		const config = vscode.workspace.getConfiguration('textile', resource ?? null);
		// -- Begin : Changed for textile
		return {
			breaks: config.get<boolean>('preview.breaks', false),
			/* Disabled for Textile :
			linkify: config.get<boolean>('preview.linkify', true),
			typographer: config.get<boolean>('preview.typographer', false)
			 */
			showOriginalLineNumber: true,
			cssClassOriginalLineNumber: 'code-line',
			dontEscapeContentForTags: ['code'],
		};
		// -- End : Changed for textile
	}

	// -- Begin : Changed for textile
	private addImageRenderer(textile: TextileJS, config: TextileJSConfig): void {
		config.hooks!.push(
			[(tokens: Token[], _attributes, _content, env = {}) => {
				switch( tokens[0] ) {
					case 'img':
						let className = (tokens[1]?.class || '') + ' loading';
						textile.jsonmlUtils.addAttributes( tokens, {'class': className}); 

						const src = tokens[1]?.src;
						if (src) {
							env.containingImages?.push({ src });
							const imgHash = hash(src);
							textile.jsonmlUtils.addAttributes( tokens, {'id': `image-hash-${imgHash}`});

							if (!tokens[1]?.['data-src']) {
								textile.jsonmlUtils.addAttributes( tokens, {'src': this.toResourceUri(src, env.currentDocument, env.resourceProvider)});
								textile.jsonmlUtils.addAttributes( tokens, {'data-src': src});
							}
						}
						break;
					default:
						break;
				}
				return tokens;
			}]
		);
	}

	private async addFencedRenderer(textile: TextileJS, config: TextileJSConfig) {
		const hljs = await import('highlight.js');
		config.renderers!.push(
			(tag, attributes, content) => {
				if (tag === 'code') {
					if (attributes) {
						let lang = attributes['lang'] || attributes['class'];
						lang = normalizeHighlightLang(lang);
						if (lang && hljs.getLanguage(lang)) {
							try {
								return hljs.highlight(lang, content, true).value;
							}
							catch (error) { }
						}
					}
					return textile.jsonmlUtils.escape(content);
				}
				return content;
			}
		);
	}
	// -- End : Changed for textile

	/* FIXME ?
	private addLinkNormalizer(md: TextileJS): void {
		const normalizeLink = md.normalizeLink;
		md.normalizeLink = (link: string) => {
			try {
				// Normalize VS Code schemes to target the current version
				if (isOfScheme(Schemes.vscode, link) || isOfScheme(Schemes['vscode-insiders'], link)) {
					return normalizeLink(vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }).toString());
				}

			} catch (e) {
				// noop
			}
			return normalizeLink(link);
		};
	}

	private addLinkValidator(md: TextileJS): void {
		const validateLink = md.validateLink;
		md.validateLink = (link: string) => {
			return validateLink(link)
				|| isOfScheme(Schemes.vscode, link)
				|| isOfScheme(Schemes['vscode-insiders'], link)
				|| /^data:image\/.*?;/.test(link);
		};
	}
	*/

	// -- Begin : Changed for textile
	private addNamedHeaders(textile: TextileJS, config: TextileJSConfig): void {
		config.hooks!.push(
			[(tokens: Token[]) => {
				switch( tokens[0] ) {
					case 'h1':
					case 'h2':
					case 'h3':
					case 'h4':
					case 'h5':
					case 'h6':
						const title = this.reduceTokenString( tokens );
						let slug = this.slugifier.fromHeading(title);

						if (this._slugCount.has(slug.value)) {
							const count = this._slugCount.get(slug.value)!;
							this._slugCount.set(slug.value, count + 1);
							slug = this.slugifier.fromHeading(slug.value + '-' + (count + 1));
						} else {
							this._slugCount.set(slug.value, 0);
						}
						textile.jsonmlUtils.addAttributes( tokens, { 'id': slug.value } );
						break;
					default:
						break;
				}
				return tokens;
			}]
		);
	}

	private addLinkRenderer(textile: TextileJS, config: TextileJSConfig): void {
		config.hooks!.push(
			[(tokens: Token[]) => {
				switch( tokens[0] ) {
					case 'a':
						const href = tokens[1]?.href;
						// A string, including empty string, may be `href`.
						if (typeof href === 'string') {
							textile.jsonmlUtils.addAttributes( tokens, {'data-href': href});
						}
						break;
					default:
						break;
				}
				return tokens;
			}]
		);
	}
	// -- End : Changed for textile

	private toResourceUri(href: string, currentDocument: vscode.Uri | undefined, resourceProvider: WebviewResourceProvider | undefined): string {
		try {
			// Support file:// links
			if (isOfScheme(Schemes.file, href)) {
				const uri = vscode.Uri.parse(href);
				if (resourceProvider) {
					return resourceProvider.asWebviewUri(uri).toString(true);
				}
				// Not sure how to resolve this
				return href;
			}

			// If original link doesn't look like a url with a scheme, assume it must be a link to a file in workspace
			if (!/^[a-z\-]+:/i.test(href)) {
				// Use a fake scheme for parsing
				let uri = vscode.Uri.parse('textile-link:' + href);

				// Relative paths should be resolved correctly inside the preview but we need to
				// handle absolute paths specially to resolve them relative to the workspace root
				if (uri.path[0] === '/' && currentDocument) {
					const root = vscode.workspace.getWorkspaceFolder(currentDocument);
					if (root) {
						uri = vscode.Uri.joinPath(root.uri, uri.fsPath).with({
							fragment: uri.fragment,
							query: uri.query,
						});

						if (resourceProvider) {
							return resourceProvider.asWebviewUri(uri).toString(true);
						} else {
							uri = uri.with({ scheme: 'textile-link' });
						}
					}
				}

				return uri.toString(true).replace(/^textile-link:/, '');
			}

			return href;
		} catch {
			return href;
		}
	}
}

/* Disabled for textile : Done in addFencedRenderer
async function getTextileOptions(md: () => TextileJS) {
	const hljs = await import('highlight.js');
	return {
		html: true,
		highlight: (str: string, lang?: string) => {
			lang = normalizeHighlightLang(lang);
			if (lang && hljs.getLanguage(lang)) {
				try {
					return `<div>${hljs.highlight(lang, str, true).value}</div>`;
				}
				catch (error) { }
			}
			return `<code><div>${md().utils.escapeHtml(str)}</div></code>`;
		}
	};
}
*/

function normalizeHighlightLang(lang: string | undefined) {
	switch (lang && lang.toLowerCase()) {
		case 'tsx':
		case 'typescriptreact':
			// Workaround for highlight not supporting tsx: https://github.com/isagalaev/highlight.js/issues/1155
			return 'jsx';

		case 'json5':
		case 'jsonc':
			return 'json';

		case 'c#':
		case 'csharp':
			return 'cs';

		default:
			return lang;
	}
}
