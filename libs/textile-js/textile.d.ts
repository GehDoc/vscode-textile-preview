// Partial type definitions for textile-js (modified) 2.0.107
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

declare namespace TextileJS {
	type Token = any;

	type Hook = [{ (tokens: Token[], params: any | undefined, nodeLevel: number, context?: any): Token[]; }, any?];

	type jsonmlAttributes = { [key:string]: any };

	type Renderer = {(tag: string, attributes: jsonmlAttributes, content: string, context?: any) : string; };

	type Options = {
		breaks? :boolean,
		showOriginalLineNumber? :boolean,
		lineOffset? :number,
		cssClassOriginalLineNumber?: string,
		hooks?: Hook[],
		renderers?: Renderer[],
		dontEscapeContentForTags? :string[],
	};
}

interface TextileJS {
	convert(text: string, options?: TextileJS.Options, context?: any): string;
	setOptions(options: TextileJS.Options): object;

	tokenize(text: string, options?: TextileJS.Options, context?: any): TextileJS.Token[];
	serialize(tokens: TextileJS.Token[], options?: TextileJS.Options, context?: any): string;

	jsonmlUtils: {
		applyHooks(jsonml: TextileJS.Token[], hooks: TextileJS.Hook[], nodeLevel?: number, context?: any): TextileJS.Token[];
		addAttributes(jsonml: TextileJS.Token[], newAttr: TextileJS.jsonmlAttributes): TextileJS.jsonmlAttributes;
		escape(text: string, escapeQuotes?: boolean): string;
	};
}

declare const TextileJS: TextileJS;

export = TextileJS;
