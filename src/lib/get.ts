import * as parse from "json-to-ast"
import {JsonValue, JsonValueU} from "./json-value"
import type * as Manifest from "./manifest"
import {SoaRecord} from "dns"

type Path = Array<number | string>

export interface Point {
	line: number
	column: number
	offset: number
}

export interface Position {
	path: Path
	start?: Point
	end?: Point
}

type ManifestFileName = "origami.json" | "bower.json" | "package.json"

/** Information for a node to make a problem out of */
export interface Source {
	/** potentially problematic file */
	file: ManifestFileName
	/** the position in the json file  */
	start?: Point
	end?: Point
	path: Array<string | number>
	value: JsonValueU
}

interface ValueSource {
	value: JsonValueU
	source: Source
}

export type GetPath = Array<number | string>

export interface Get {
	(...path: GetPath): ValueSource
}

// keypath like demos[1].template
export default function get<ManifestT extends Manifest.Manifest>(
	file: ManifestFileName,
	/** The contents of a json file */
	json: string,
	/** The manifest we are looking at */
	manifest: ManifestT
) {
	return (
		/** @example ["demos", 1, "template"] */
		...path: Array<string | number>
	): ValueSource => {
		// a source for when the item is just not there
		let notFoundSource: Source = {
			file,
			path,
			value: undefined,
		}

		let notFound: ValueSource = {value: undefined, source: notFoundSource}
		/** the ast, or the current traversal value */
		let ast = parse(json)
		let actualValue: JsonValue = manifest
		let astValue: parse.ValueNode = ast

		for (let key of path) {
			if (typeof key == "number") {
				if (Array.isArray(actualValue)) {
					actualValue = actualValue[key]
					if (astValue.type == "Array") {
						astValue = astValue.children[key]
					}
				} else {
					if (!isNaN(Number(key))) {
						console.error(
							`tried to index on an array with a string. use a number`
						)
					}
					return notFound
				}
			} else if (Array.isArray(actualValue)) {
				return notFound
			} else if (actualValue === null) {
				return notFound
			} else if (typeof actualValue == "string") {
				return notFound
			} else if (typeof actualValue == "number") {
				return notFound
			} else if (typeof actualValue == "boolean") {
				return notFound
			} else if (key in actualValue) {
				actualValue = actualValue[key]
				// we know this if statement is true because of the above, but ts doesn't
				if (astValue.type == "Object") {
					let property: parse.PropertyNode | undefined = astValue.children.find(
						property => {
							return property.key.value == key
						}
					)
					if (property && property.value) {
						astValue = property.value
						continue
					}
				}
				throw new Error("Well how did that even happen?")
			} else {
				return notFound
			}
		}

		return {
			value: actualValue,
			source: {
				file,
				path,
				start: astValue.loc?.start,
				end: astValue.loc?.end,
				value: actualValue,
			},
		}
	}
}

if (process.env.NODE_ENV == "test") {
	import("tap").then(async tap => {
		tap.test("returns the correct position for an object", t => {
			let json = `{
	"name": "dingus",
	"demos": [
		{
			"template": "monkey"
		},
		{
			"template": "badger"
		}
	]
}`
			let manifest: Manifest.Origami = JSON.parse(json)
			void (() => {
				let {value, source} = get<Manifest.Origami>(
					"origami.json",
					json,
					manifest
				)("demos", 0)
				t.isNot(source, undefined)
				t.deepEqual(value, {template: "monkey"})
				t.isEqual(source?.start?.line, 4)
				t.isEqual(source?.start?.column, 3)
				t.isEqual(source?.end?.line, 6)
				t.isEqual(source?.end?.column, 4)
			})()

			void (() => {
				let {value, source} = get<Manifest.Origami>(
					"origami.json",
					json,
					manifest
				)("dingus", 0)
				t.isNot(source, undefined)
				t.is(value, undefined)
			})()

			void (() => {
				let {value, source} = get<Manifest.Origami>(
					"origami.json",
					json,
					manifest
				)("demos", 1, "template")
				t.isNot(value, undefined)
				t.isNot(source, undefined)
				t.is(value, "badger")
				t.isEqual(source?.start?.line, 8)
				t.isEqual(source?.start?.column, 16)
				t.isEqual(source?.end?.line, 8)
				t.isEqual(source?.end?.column, 24)
				t.done()
			})()
		})
	})
}
