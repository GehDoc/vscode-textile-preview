// Partial type definitions for textile-js (modified) 2.0.104
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

export = TextileJS;

declare namespace TextileJS {
	type Token = any;

	type Hook = [{ (tokens: Token[], params?: any): Token[]; }, any?];

	type jsonmlAttributes = { [key:string]: any };

	type Options = {
		breaks? :boolean,
		showOriginalLineNumber? :boolean,
		lineOffset? :number,
		cssClassOriginalLineNumber?: string,
		hooks?: Hook[];
	};

	interface TextileJS {
		convert(text: string, options: undefined | Options): string;
		setOptions(options: Options): object;

		tokenize(text: string, options: undefined | Options): Token[];
		serialize(tokens: Token[]): string;

		jsonmlUtils: {
			applyHooks(jsonml: Token[], hooks: Hook[]): Token[];
			addAttributes(jsonml: Token[], newAttr: jsonmlAttributes): jsonmlAttributes;
		};
	}
}