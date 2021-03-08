// Partial type definitions for textile-js (modified) 2.0.107
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

export = TextileJS;

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

	interface TextileJS {
		convert(text: string, options?: Options, context?: any): string;
		setOptions(options: Options): object;

		tokenize(text: string, options?: Options, context?: any): Token[];
		serialize(tokens: Token[], options?: Options, context?: any): string;

		jsonmlUtils: {
			applyHooks(jsonml: Token[], hooks: Hook[], nodeLevel?: number, context?: any): Token[];
			addAttributes(jsonml: Token[], newAttr: jsonmlAttributes): jsonmlAttributes;
			escape(text: string, escapeQuotes?: boolean): string;
		};
	}
}