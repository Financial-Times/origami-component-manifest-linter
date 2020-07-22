export type JsonDictionary<T extends JsonValue> = {[key: string]: T}
export type JsonObject = {[key: string]: JsonValue}

export type JsonValue =
	| number
	| JsonObject
	| string
	| Array<JsonValue>
	| boolean
	| null

export type JsonValueU =
	| number
	| JsonObject
	| string
	| Array<JsonValue>
	| boolean
	| null
	| undefined

export function isNumber(value: JsonValueU): value is number {
	return typeof value === "number"
}

export function isObject(value: JsonValueU): value is JsonObject {
	return !isNull(value) && typeof value == "object"
}

export function isString(value: JsonValueU): value is string {
	return typeof value === "string"
}

export function isArray(value: JsonValueU): value is Array<any> {
	return Array.isArray(value)
}

export function isBoolean(value: JsonValueU): value is boolean {
	return typeof value === "boolean"
}

export function isNull(value: JsonValueU): value is null {
	return value === null
}

export function isUndefined(value: JsonValueU): value is undefined | null {
	return value == null
}
