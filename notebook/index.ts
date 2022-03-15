/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const TextileJS = require('../libs/textile-js/textile');
import * as DOMPurify from 'dompurify';
import type { ActivationFunction } from 'vscode-notebook-renderer';
import type * as Textile from '../libs/textile-js/textile';

const sanitizerOptions: DOMPurify.Config = {
	ALLOWED_TAGS: ['a', 'button', 'blockquote', 'code', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'input', 'label', 'li', 'p', 'pre', 'select', 'small', 'span', 'strong', 'textarea', 'ul', 'ol'],
};

export const activate: ActivationFunction = (ctx) => {
	console.log('Notebook renderer launched');

	const localConfig :Textile.Options = {
		hooks: [],
		renderers: []
	};
	/* FIXME: enable for Textile
	addNamedHeaderRendering(textile, localConfig);
	*/
	let textile = new TextileJS(localConfig);
	console.log('Notebook renderer activated');
	const style = document.createElement('style');
	style.textContent = `
		.emptyTextileCell::before {
			content: "${document.documentElement.style.getPropertyValue('--notebook-cell-markup-empty-content')}";
			font-style: italic;
			opacity: 0.6;
		}

		img {
			max-width: 100%;
			max-height: 100%;
		}

		a {
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

		a:focus,
		input:focus,
		select:focus,
		textarea:focus {
			outline: 1px solid -webkit-focus-ring-color;
			outline-offset: -1px;
		}

		hr {
			border: 0;
			height: 2px;
			border-bottom: 2px solid;
		}

		h1 {
			font-size: 26px;
			line-height: 31px;
			margin: 0;
			margin-bottom: 13px;
		}

		h2 {
			font-size: 19px;
			margin: 0;
			margin-bottom: 10px;
		}

		h1,
		h2,
		h3 {
			font-weight: normal;
		}

		div {
			width: 100%;
		}

		/* Adjust margin of first item in textile cell */
		*:first-child {
			margin-top: 0px;
		}

		/* h1 tags don't need top margin */
		h1:first-child {
			margin-top: 0;
		}

		/* Removes bottom margin when only one item exists in textile cell */
		*:only-child,
		*:last-child {
			margin-bottom: 0;
			padding-bottom: 0;
		}

		/* makes all textile cells consistent */
		div {
			min-height: var(--notebook-textile-min-height);
		}

		table {
			border-collapse: collapse;
			border-spacing: 0;
		}

		table th,
		table td {
			border: 1px solid;
		}

		table > thead > tr > th {
			text-align: left;
			border-bottom: 1px solid;
		}

		table > thead > tr > th,
		table > thead > tr > td,
		table > tbody > tr > th,
		table > tbody > tr > td {
			padding: 5px 10px;
		}

		table > tbody > tr + tr > td {
			border-top: 1px solid;
		}

		blockquote {
			margin: 0 7px 0 5px;
			padding: 0 16px 0 10px;
			border-left-width: 5px;
			border-left-style: solid;
		}

		code,
		.code {
			font-size: 1em;
			line-height: 1.357em;
		}

		.code {
			white-space: pre-wrap;
		}
	`;
	const template = document.createElement('template');
	template.classList.add('textile-style');
	template.content.appendChild(style);
	document.head.appendChild(template);

	return {
		renderOutputItem: (outputInfo: { text(): string }, element: HTMLElement) => {
			let previewNode: HTMLElement;
			if (!element.shadowRoot) {
				const previewRoot = element.attachShadow({ mode: 'open' });

				// Insert styles into textile preview shadow dom so that they are applied.
				// First add default webview style
				const defaultStyles = document.getElementById('_defaultStyles') as HTMLStyleElement;
				previewRoot.appendChild(defaultStyles.cloneNode(true));

				// And then contributed styles
				for (const element of document.getElementsByClassName('textile-style')) {
					if (element instanceof HTMLTemplateElement) {
						previewRoot.appendChild(element.content.cloneNode(true));
					} else {
						previewRoot.appendChild(element.cloneNode(true));
					}
				}

				previewNode = document.createElement('div');
				previewNode.id = 'preview';
				previewRoot.appendChild(previewNode);
			} else {
				previewNode = element.shadowRoot.getElementById('preview')!;
			}

			const text = outputInfo.text();
			if (text.trim().length === 0) {
				previewNode.innerText = '';
				previewNode.classList.add('emptyTextileCell');
			} else {
				previewNode.classList.remove('emptyTextileCell');

				const unsanitizedRenderedTextile = textile.render(text);
				previewNode.innerHTML = ctx.workspace.isTrusted
					? unsanitizedRenderedTextile
					: DOMPurify.sanitize(unsanitizedRenderedTextile, sanitizerOptions);
			}
		},
		extendTextileJS: (f: (textile: Textile.TextileJS) => void) => {
			f(textile);
		}
	};
}

/* FIXME: enable for Textile
function addNamedHeaderRendering(textile: Textile.TextileJS, config: Textile.Options): void {
	const slugCounter = new Map<string, number>();

	const originalHeaderOpen = textile.renderer.rules.heading_open;
	textile.renderer.rules.heading_open = (tokens: Textile.Token[], idx: number, options: any, env: any, self: any) => {
		const title = tokens[idx + 1].children.reduce((acc: string, t: any) => acc + t.content, '');
		let slug = slugFromHeading(title);

		if (slugCounter.has(slug)) {
			const count = slugCounter.get(slug)!;
			slugCounter.set(slug, count + 1);
			slug = slugFromHeading(slug + '-' + (count + 1));
		} else {
			slugCounter.set(slug, 0);
		}

		tokens[idx].attrs = tokens[idx].attrs || [];
		tokens[idx].attrs.push(['id', slug]);

		if (originalHeaderOpen) {
			return originalHeaderOpen(tokens, idx, options, env, self);
		} else {
			return self.renderToken(tokens, idx, options, env, self);
		}
	};

	const originalRender = textile.render;
	textile.render = function () {
		slugCounter.clear();
		return originalRender.apply(this, arguments as any);
	};
}

function slugFromHeading(heading: string): string {
	const slugifiedHeading = encodeURI(
		heading.trim()
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace whitespace with -
			.replace(/[\]\[\!\'\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~\`。，、；：？！…—·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '') // Remove known punctuators
			.replace(/^\-+/, '') // Remove leading -
			.replace(/\-+$/, '') // Remove trailing -
	);
	return slugifiedHeading;
}
*/
