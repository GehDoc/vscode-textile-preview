// Partial type definitions for textile-js (modified) > 2.0.105
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

export = TextileJS;

declare namespace TextileJS {
	type Token = any;

	type Hook = [{ (tokens: Token[], params: any | undefined, nodeLevel: number): Token[]; }, any?];

	type jsonmlAttributes = { [key:string]: any };

	type Render = {
		content?: {(tag: string, attributes: jsonmlAttributes, content: string) : string; }
	};

	type Options = {
		breaks? :boolean,
		showOriginalLineNumber? :boolean,
		lineOffset? :number,
		cssClassOriginalLineNumber?: string,
		hooks?: Hook[],
		render?: Render,
	};

	interface TextileJS {
		convert(text: string, options?: Options): string;
		setOptions(options: Options): object;

		tokenize(text: string, options?: Options): Token[];
		serialize(tokens: Token[], options?: Options): string;

		jsonmlUtils: {
			applyHooks(jsonml: Token[], hooks: Hook[]): Token[];
			addAttributes(jsonml: Token[], newAttr: jsonmlAttributes): jsonmlAttributes;
		};
	}
}