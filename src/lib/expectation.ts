import {JsonValueU, JsonValue} from "./json-value"

/**
 * a generic expectation for printing special messages.
 *
 * these should be used sparingly.
 * if a pattern emerges, create a specific Expectation and use that
 * */
export interface Message {
	type: "message"
}

/**
 * Create a {@link Message} expectation
 */
export function message(): Message {
	return {
		type: "message",
	}
}

export type TypeOfType = "string" | "boolean" | "array" | "number" | "object"

/**
 * an expectation for unexpected types
 */
export interface TypeOf {
	type: "typeOf"
	expected: TypeOfType[]
	received: JsonValueU
}

/**
 * Create a {@link TypeOf} expectation
 */
export function typeOf(expected: TypeOfType[], received: JsonValueU): TypeOf {
	return {
		type: "typeOf",
		expected,
		received,
	}
}

/**
 * an expectation for things that were meant to be files
 */
export interface File {
	type: "file"
	received: JsonValueU
}

/**
 * Create a {@link File} expectation
 */
export function file(received: JsonValueU): File {
	return {
		type: "file",
		received,
	}
}

/**
 * an expectation for things that were meant to be Urls
 */
export interface Url {
	type: "url"
	received: JsonValueU
}

/**
 * Create a {@link Url} expectation
 */
export function url(received: JsonValueU): Url {
	return {
		type: "url",
		received,
	}
}

/**
 * an expectation for a specific value
 */
export interface ValueOf<T> {
	type: "valueOf"
	expected: T
	received: JsonValueU
}

/**
 * Create a {@link ValueOf} expectation
 */
export function valueOf<T>(expected: T, received: JsonValueU): ValueOf<T> {
	return {
		type: "valueOf",
		expected,
		received,
	}
}

/**
 * an expectation for a value that's one of a set
 */
export interface MemberOf<T extends JsonValue> {
	type: "memberOf"
	list: T[]
	received: JsonValueU
}

/**
 * Create a {@link MemberOf} expectation
 */
export function memberOf<T extends JsonValue>(
	list: T[],
	received: JsonValueU
): MemberOf<T> {
	return {
		type: "memberOf",
		list,
		received,
	}
}

/**
 * an expectation for a strings that begin a certain way
 */
export interface StartsWith {
	type: "startsWith"
	prefix: string
	received: JsonValueU
}

/**
 * Create a {@link StartsWith} expectation
 */
export function startsWith(
	expectedPrefix: string,
	received: JsonValueU
): StartsWith {
	return {
		type: "startsWith",
		prefix: expectedPrefix,
		received,
	}
}

/**
 * an expectation for a strings that match a regexp
 */
export interface Match {
	type: "match"
	regexp: RegExp
	received: JsonValueU
}

/**
 * Create a {@link Match} expectation
 */
export function match(regexp: RegExp, received: JsonValueU): Match {
	return {
		type: "match",
		regexp,
		received,
	}
}

/**
 * an expectation for a strings that are at least a certain length
 */
export interface LongerThan {
	type: "longerThan"
	minimum: number
	received: JsonValueU
}

/**
 * Create a {@link LongerThan} expectation
 */
export function longerThan(minimum: number, received: JsonValueU): LongerThan {
	return {
		type: "longerThan",
		minimum,
		received,
	}
}

/**
 * an expectation for a strings that are at most a certain length
 */
export interface ShorterThan {
	type: "shorterThan"
	maximum: number
	received: string
}

export type Any =
	| TypeOf
	| ValueOf<any>
	| MemberOf<any>
	| StartsWith
	| Match
	| LongerThan
	| ShorterThan
	| File
	| Url
	| Message
