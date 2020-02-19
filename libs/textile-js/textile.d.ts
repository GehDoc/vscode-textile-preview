// Partial type definitions for textile-js (modified) 2.0.102
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

export = TextileJS;

declare namespace TextileJS {
	type Token = any;

	interface TextileJS {
		convert(text: string, options: undefined | object): string;
		setOptions(options: object): object;

		tokenize(text: string, options: undefined | object): Token[];
		serialize(tokens: Token[]): string;
	}
}