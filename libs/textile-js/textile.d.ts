// Quick and dirty type definitions for textile-js (modified) 2.0.99
// Project: https://github.com/GehDoc/textile-js/
// Definitions by: Gérald Hameau <https://github.com/GehDoc>

interface TextileJS {
	convert(text: string, options: undefined | object): string;
	setOptions(options: object): object;
}

export = TextileJS;