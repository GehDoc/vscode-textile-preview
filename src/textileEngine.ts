/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextileJS, Token, Options as TextileJSConfig } from '../libs/textile-js/textile';
//import * as path from 'path';
import * as vscode from 'vscode';
import { TextileContributionProvider as TextileContributionProvider } from './textileExtensions';
import { Slugifier } from './slugify';
import { SkinnyTextDocument } from './tableOfContentsProvider';
import { hash } from './util/hash';
//import { isOfScheme, TextileFileExtensions, Schemes } from './util/links';

const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;

/* Disabled for textile : already defined in textile lib
interface TextileJSConfig {
	readonly breaks: boolean;
	readonly linkify: boolean;
}
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
}

export class TextileEngine {
	private textile?: Promise<TextileJS>;

	// Disabled for textile : private currentDocument?: vscode.Uri;
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
			this.textile = import('../libs/textile-js/textile').then(async textile => {
				/* -- Begin : changed for Textile :
				let md: TextileJS = textileIt(await getTextileOptions(() => md));

				for (const plugin of this.contributionProvider.contributions.textileItPlugins.values()) {
					try {
						md = (await plugin)(md);
					} catch {
						// noop
					}
				}

				const frontMatterPlugin = require('textile-it-front-matter');
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

				for (const renderName of ['paragraph_open', 'heading_open', 'image', 'code_block', 'fence', 'blockquote_open', 'list_item_open']) {
					this.addLineNumberRenderer(md, renderName);
				}
				*/

				// hooks are set only once : don't add them to config member parameter
				const localConfig :TextileJSConfig = {
					hooks: [],
					renderers: []
				};
				this.addImageStabilizer(textile, localConfig);
				this.addFencedRenderer(textile, localConfig);
				// FIXME ? this.addLinkNormalizer(md);
				// FIXME ? this.addLinkValidator(md);
				this.addNamedHeaders(textile, localConfig);
				// disabled for textile : this.addLinkRenderer(md);
				textile.setOptions( localConfig );
				// -- End : changed for textile

				return textile;
			});
		}

		const textile = await this.textile!;
		textile.setOptions(config); // Changed for texile
		return textile;
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

		// Disabled for textile : this.currentDocument = document.uri;

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

	public async render(input: SkinnyTextDocument | string): Promise<RenderOutput> {
		const config = this.getConfig(typeof input === 'string' ? undefined : input.uri);
		const engine = await this.getEngine(config);

		const env: RenderEnv = {
			containingImages: []
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
		const config = vscode.workspace.getConfiguration('textile', resource);
		// -- Begin : Changed for textile
		return {
			breaks: config.get<boolean>('preview.breaks', false),
			/* Disabled for Textile : linkify: config.get<boolean>('preview.linkify', true), */
			showOriginalLineNumber: true,
			cssClassOriginalLineNumber: 'code-line',
			dontEscapeContentForTags: ['code'],
		};
		// -- End : Changed for textile
	}

	/* Disabled for textile : not necessary
	private addLineNumberRenderer(md: any, ruleName: string): void {
		const original = md.renderer.rules[ruleName];
		md.renderer.rules[ruleName] = (tokens: any, idx: number, options: any, env: any, self: any) => {
			const token = tokens[idx];
			if (token.map && token.map.length) {
				token.attrSet('data-line', token.map[0]);
				token.attrJoin('class', 'code-line');
			}

			if (original) {
				return original(tokens, idx, options, env, self);
			} else {
				return self.renderToken(tokens, idx, options, env, self);
			}
		};
	}
	*/

	// -- Begin : Changed for textile
	private addImageStabilizer(textile: TextileJS, config: TextileJSConfig): void {
		config.hooks!.push(
			[(tokens: Token[], _attributes, _content, env) => {
				switch( tokens[0] ) {
					case 'img':
						let className = (tokens[1]?.class || '') + ' loading';
						textile.jsonmlUtils.addAttributes( tokens, {'class': className}); 

						const src = tokens[1]?.src;
						if (src) {
							env?.containingImages?.push({ src });
							const imgHash = hash(src);
							textile.jsonmlUtils.addAttributes( tokens, {'id': `image-hash-${imgHash}`});
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
	private addLinkNormalizer(md: any): void {
		const normalizeLink = md.normalizeLink;
		md.normalizeLink = (link: string) => {
			try {
				// Normalize VS Code schemes to target the current version
				if (isOfScheme(Schemes.vscode, link) || isOfScheme(Schemes['vscode-insiders'], link)) {
					return normalizeLink(vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }).toString());
				}

				// Support file:// links
				if (isOfScheme(Schemes.file, link)) {
					// Ensure link is relative by prepending `/` so that it uses the <base> element URI
					// when resolving the absolute URL
					return normalizeLink('/' + link.replace(/^file:/, 'file'));
				}

				// If original link doesn't look like a url with a scheme, assume it must be a link to a file in workspace
				if (!/^[a-z\-]+:/i.test(link)) {
					// Use a fake scheme for parsing
					let uri = vscode.Uri.parse('textile-link:' + link);

					// Relative paths should be resolved correctly inside the preview but we need to
					// handle absolute paths specially (for images) to resolve them relative to the workspace root
					if (uri.path[0] === '/') {
						const root = vscode.workspace.getWorkspaceFolder(this.currentDocument!);
						if (root) {
							const fileUri = vscode.Uri.joinPath(root.uri, uri.fsPath).with({
								fragment: uri.fragment,
								query: uri.query,
							});

							// Ensure fileUri is relative by prepending `/` so that it uses the <base> element URI
							// when resolving the absolute URL
							uri = vscode.Uri.parse('textile-link:' + '/' + fileUri.toString(true).replace(/^\S+?:/, fileUri.scheme));
						}
					}

					const extname = path.extname(uri.fsPath);

					if (uri.fragment && (extname === '' || TextileFileExtensions.includes(extname))) {
						uri = uri.with({
							fragment: this.slugifier.fromHeading(uri.fragment).value
						});
					}
					return normalizeLink(uri.toString(true).replace(/^textile-link:/, ''));
				}
			} catch (e) {
				// noop
			}
			return normalizeLink(link);
		};
	}

	private addLinkValidator(md: any): void {
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
	// -- End : Changed for textile

	/* FIXME ?
	private addLinkRenderer(md: any): void {
		const old_render = md.renderer.rules.link_open || ((tokens: any, idx: number, options: any, _env: any, self: any) => {
			return self.renderToken(tokens, idx, options);
		});

		md.renderer.rules.link_open = (tokens: any, idx: number, options: any, env: any, self: any) => {
			const token = tokens[idx];
			const hrefIndex = token.attrIndex('href');
			if (hrefIndex >= 0) {
				const href = token.attrs[hrefIndex][1];
				token.attrPush(['data-href', href]);
			}
			return old_render(tokens, idx, options, env, self);
		};
	}
	*/
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
