import {JsonValueU, JsonValue} from "./json-value"

export type TypeOfType = "string" | "boolean" | "array" | "number" | "object"

export interface TypeOf {
	type: "typeOf"
	expected: TypeOfType[]
	received: JsonValueU
}

/**
 * a generic expectation for printing special messages.
 *
 * these should be used sparingly.
 * if a pattern emerges, create a specific Expectation and use that
 * */
export interface Message {
	type: "message"
}

export function message(): Message {
	return {
		type: "message",
	}
}

export function typeOf(expected: TypeOfType[], received: JsonValueU): TypeOf {
	return {
		type: "typeOf",
		expected,
		received,
	}
}

export interface File {
	type: "file"
	received: JsonValueU
}

export function file(received: JsonValueU): File {
	return {
		type: "file",
		received,
	}
}

export interface Url {
	type: "url"
	received: JsonValueU
}

export function url(received: JsonValueU): Url {
	return {
		type: "url",
		received,
	}
}

export interface ValueOf<T> {
	type: "valueOf"
	expected: T
	received: JsonValueU
}

export function valueOf<T>(expected: T, received: JsonValueU): ValueOf<T> {
	return {
		type: "valueOf",
		expected,
		received,
	}
}

export interface MemberOf<T extends JsonValue> {
	type: "memberOf"
	list: T[]
	received: JsonValueU
}

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

export interface StartsWith {
	type: "startsWith"
	prefix: string
	received: JsonValueU
}

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

export interface Match {
	type: "match"
	regexp: RegExp
	received: JsonValueU
}

export function match(regexp: RegExp, received: JsonValueU): Match {
	return {
		type: "match",
		regexp,
		received,
	}
}

export interface LongerThan {
	type: "longerThan"
	minimum: number
	received: JsonValueU
}

export function longerThan(minimum: number, received: JsonValueU): LongerThan {
	return {
		type: "longerThan",
		minimum,
		received,
	}
}

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
