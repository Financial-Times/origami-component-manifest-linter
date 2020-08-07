import type {JsonObject, JsonDictionary, JsonValue} from "./json-value"
import * as parse from "json-to-ast"

export interface Origami extends JsonObject {
	description: string
	origamiType: "module" | "component"
	origamiVersion: 1
	brands: string[]
	keywords: string[]
	origamiCategory: string
	support: string
	supportStatus:
		| "active"
		| "maintained"
		| "deprecated"
		| "dead"
		| "experimental"
	supportContact: {
		email: string
		slack: string
	}
	ci: null
	browserFeatures: {
		required: string[]
		optional: string[]
	}
	demosDefaults: {
		template: string
		sass: string
		js: string
		data: string | {[key: string]: string}
		documentClasses: string
		dependencies: string[]
	}
	demos: {
		name: string
		title: string
		description: string
		template: string
		sass: string
		js: string
		data: string | {[key: string]: string}
		// a space separated string??
		documentClasses: string
		dependencies: string[]
		brands: string[]
		hidden: boolean
		// why is this not camelcase
		display_html: boolean
	}[]
}

interface Property<K extends string, V extends parse.ValueNode>
	extends parse.PropertyNode {
	type: "Property"
	key: {
		type: "Identifier"
		value: K
		raw: K
	}
	value: V
}

interface BrowserFeaturesAst extends parse.ObjectNode {
	required: parse.ArrayNode
	optional: parse.ArrayNode
}

interface DemoDefaultsAst extends parse.ObjectNode {
	children: [
		Property<"template", parse.LiteralNode>,
		Property<"sass", parse.LiteralNode>,
		Property<"js", parse.LiteralNode>,
		Property<"data", parse.ObjectNode | parse.LiteralNode>,
		Property<"documentClasses", parse.LiteralNode>,
		Property<"dependencies", parse.ArrayNode>
	]
}

interface DemoAst extends parse.ObjectNode {
	children: [
		Property<"template", parse.LiteralNode>,
		Property<"sass", parse.LiteralNode>,
		Property<"js", parse.LiteralNode>,
		Property<"data", parse.ObjectNode | parse.LiteralNode>,
		Property<"documentClasses", parse.LiteralNode>,
		Property<"dependencies", parse.ArrayNode>,
		Property<"name", parse.LiteralNode>,
		Property<"title", parse.LiteralNode>,
		Property<"description", parse.LiteralNode>,
		Property<"documentClasses", parse.LiteralNode>,
		Property<"dependencies", parse.ArrayNode>,
		Property<"brands", parse.ArrayNode>,
		Property<"hidden", parse.LiteralNode>,
		Property<"display_html", parse.LiteralNode>
	]
}

interface DemosAst extends parse.ArrayNode {
	children: DemoAst[]
}

export interface OrigamiAst extends parse.ObjectNode {
	children: [
		Property<"descrption", parse.LiteralNode>,
		Property<"origamiType", parse.LiteralNode>,
		Property<"origamiVersion", parse.LiteralNode>,
		Property<"brands", parse.ArrayNode>,
		Property<"keywords", parse.ArrayNode>,
		Property<"origamiCategory", parse.LiteralNode>,
		Property<"support", parse.LiteralNode>,
		Property<"supportStatus", parse.LiteralNode>,
		Property<"supportContact", parse.ObjectNode>,
		Property<"browserFeatures", BrowserFeaturesAst>,
		Property<"demosDefaults", DemoDefaultsAst>,
		Property<"demos", DemosAst>
	]
}

export interface Bower extends JsonObject {
	name: string
	version: null
	description: string
	main: string | string[]
	dependencies: JsonDictionary<string>
	devDependencies: JsonDictionary<string>
	moduleType: string | string[]
	keywords: string[]
	authors: string[] | JsonDictionary<string>[]
	license: string | string[]
	ignore: string[]
	private: boolean
	homepage: string
	repository: {
		type: string
		url: string
	}
	resolutions: JsonDictionary<string>
}

export interface Npm extends JsonObject {
	name: JsonValue
	version: JsonValue
	description: JsonValue
	keywords: JsonValue
	homepage: JsonValue
	bugs: JsonValue
	license: JsonValue
	author: JsonValue
	contributers: JsonValue
	files: JsonValue
	main: JsonValue
	browser: JsonValue
	bin: JsonValue
	man: JsonValue
	directories: JsonValue
	repository: JsonValue
	scripts: JsonValue
	config: JsonValue
	dependencies: JsonValue
	devDependencies: JsonValue
	peerDependencies: JsonValue
	bundledDependencies: JsonValue
	optionalDependencies: JsonValue
	engines: JsonValue
	engineStrict: JsonValue
	os: JsonValue
	cpu: JsonValue
	preferGlobal: JsonValue
	private: JsonValue
	publishConfig: JsonValue
}

export type Manifest = Bower | Npm | Origami
