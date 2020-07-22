// TODO replace all ` as ` casting with Partial<>

import type * as Manifest from "./manifest"
import get, {Source, GetPath} from "./get"
import type {Get} from "./get"
import * as Expectation from "./expectation"
import type {JsonValueU, JsonValue} from "./json-value"
import {isObject} from "./json-value"

export let NODE_TYPE = {
	BOWER_MANIFEST: "bower.json",
	BRAND: "brand",
	BRANDS: "brands",
	BROWSER_FEATURE: "browser feature",
	BROWSER_FEATURES: "browser features",
	CATEGORY: "category",
	COMPONENT: "component",
	DEMO: "demo",
	DEMOS: "demos",
	DEMOS_DEFAULTS: "demos defaults",
	DEMO_TEMPLATE: "demo template",
	DEMO_SASS: "demo sass",
	DEMO_JAVASCRIPT: "demo javascript",
	DEMO_TITLE: "demo title",
	DEMO_NAME: "demo name",
	DEMO_DOCUMENT_CLASSES: "demo document classes",
	DEMO_DEPENDENCIES: "demo dependencies",
	DEMO_DATA: "demo data",
	DEMO_DESCRIPTION: "demo description",
	DEMO_BRANDS: "demo brands",
	DEMO_HIDDEN: "demo hidden",
	DEMO_DISPLAY_HTML: "demo display html",
	DESCRIPTION: "description",
	EMAIL: "email",
	EMPTY: "empty",
	JAVASCRIPT_ENTRY: "main.js",
	KEYWORD: "keyword",
	KEYWORDS: "keywords",
	LITERAL: "literal",
	MAP: "map",
	NAME: "name",
	NPM_MANIFEST: "package.json",
	NUMBER: "number",
	OPINION: "opinion",
	OPINIONS: "opinions",
	ORIGAMI_MANIFEST: "origami.json",
	ORIGAMI_TYPE: "origami type",
	ORIGAMI_VERSION: "origami version",
	PATH: "path",
	PROBLEM: "problem",
	PROBLEMS: "problems",
	SASS_ENTRY: "main.scss",
	SLACK_CONTACT: "slack contact",
	STATUS: "status",
	STRING: "string",
	URL: "url",
} as const

export type NodeType = typeof NODE_TYPE[keyof typeof NODE_TYPE]

export interface Node {
	type: NodeType
	source: Source
	opinions?: Opinion[]
}

export interface Value<T> extends Node {
	type: NodeType
	value: T
}

interface NodeCreatorOptions {
	getBower: Get
	getNpm?: Get
	getOrigami: Get
	component: Partial<Component>
	prefix?: GetPath
}

type ValueNodeCreator<Value> = (
	nodeType: NodeType,
	value: JsonValueU,
	source: Source
) => Value

type AsyncValueNodeCreator<Value> = (
	nodeType: NodeType,
	value: JsonValueU,
	source: Source
) => Promise<Value>

type NodeCreator<Node> = (options: NodeCreatorOptions) => Node
type AsyncNodeCreator<Node> = (options: NodeCreatorOptions) => Promise<Node>

export interface Parent<Item> extends Node {
	children: Item[]
}

export interface Empty extends Node {
	type: "empty"
}

function empty(source: Source): Empty {
	return {
		type: "empty",
		source,
	}
}

let string: ValueNodeCreator<Required<Value<string>>> = (
	nodeType,
	value,
	source
) => {
	if (typeof value == "string") {
		return {
			type: nodeType,
			source,
			value,
		}
	} else {
		return expected.type(["string"], value, source).problem()
	}
}

let number: ValueNodeCreator<Required<Value<number>>> = (
	nodeType,
	value,
	source
) => {
	if (typeof value == "number") {
		return {
			type: nodeType,
			source,
			value,
		}
	} else {
		return expected.type(["number"], value, source).problem()
	}
}

export interface OrigamiVersion extends Node, Value<number> {
	type: "origami version"
}

let origamiVersion: NodeCreator<Required<OrigamiVersion>> = ({getOrigami}) => {
	let {value, source} = getOrigami("origamiVersion")
	return number(NODE_TYPE.ORIGAMI_VERSION, value, source) as OrigamiVersion
}

export interface Information extends Node {
	expectation: Expectation.Any
	/** an extra informative message */
	message?: string
}

export interface Problem extends Information, Node {
	type: "problem"
}

export interface Problems extends Parent<Problem>, Node {
	type: "problems"
}

export function problem(
	expectation: Expectation.Any,
	source: Source,
	message?: string
): Problem {
	return {
		type: "problem",
		expectation,
		source,
		message,
	}
}

export interface Opinion extends Information, Node {
	type: "opinion"
}

export function opinion(
	expectation: Expectation.Any,
	source: Source,
	message?: string
): Opinion {
	return {
		type: "opinion",
		expectation,
		source,
		message,
	}
}

type Required<N> = N | Problem | Problems

type Optional<N> = Empty | N | Problem | Problems

export interface Name extends Node, Value<string> {
	type: "name"
}

let name: NodeCreator<Required<Name>> = ({getBower, getNpm, getOrigami}) => {
	let problems = {
		type: NODE_TYPE.PROBLEMS,
		children: [] as Problem[],
	} as Problems

	let {value: bowerName, source: bowerNameSource} = getBower("name")

	if (typeof bowerName == "string") {
		let lowerCaseAsciiRegexp = /^[a-z-]+$/
		let lowerCaseAsciiMessage = "only lowercase ascii letters and hyphens"
		let bowerNameIsAscii = lowerCaseAsciiRegexp.test(bowerName)

		if (bowerNameIsAscii) {
			let node: Name = {
				type: "name",
				source: bowerNameSource,
				value: bowerName,
				opinions: [],
			}

			if (!bowerName.startsWith("o-")) {
				node.opinions?.push(
					expected
						.startsWith(
							"o-",
							bowerName,
							bowerNameSource,
							"component names should begin with o-"
						)
						.opinion()
				)
			}

			// we don't mind this if there is no npm manifest at all
			// and we're just going to error if it's not the same as the bower one
			if (getNpm) {
				let {value: npmName, source: npmNameSource} = getNpm("name")

				if (bowerName == npmName) {
					return node
				} else {
					problems.children.push(
						expected.value(bowerName, npmName, npmNameSource).problem()
					)
				}
			} else {
				return node
			}
		} else {
			problems.children.push(
				expected
					.match(
						lowerCaseAsciiRegexp,
						bowerName,
						bowerNameSource,
						lowerCaseAsciiMessage
					)
					.problem()
			)
		}
	} else {
		problems.children.push(
			expected.type(["string"], bowerName, bowerNameSource).problem()
		)
	}

	return problems
}

export interface Description extends Node {
	type: "description"
	value: string
}

let description: NodeCreator<Required<Description>> = ({
	getBower,
	getNpm,
	getOrigami,
}) => {
	let opinions = []
	let {value: description, source: descriptionSource} = getOrigami(
		"description"
	)
	if (typeof description == "string") {
		let node = {
			type: NODE_TYPE.DESCRIPTION,
			source: descriptionSource,
			value: description,
			opinions: [] as Opinion[],
		}

		let {value: bowerDescription, source: bowerDescriptionSource} = getBower(
			"description"
		)

		if (bowerDescription) {
			if (bowerDescription != description) {
				opinions.push(
					expected
						.value(
							description,
							bowerDescription,
							bowerDescriptionSource,
							"origami.json and bower.json descriptions should be the same"
						)
						.opinion()
				)
			}
		}

		if (getNpm) {
			let {value: npmDescription, source: npmDescriptionSource} = getNpm(
				"description"
			)

			if (npmDescription) {
				if (npmDescription != description) {
					opinions.push(
						expected
							.value(
								description,
								npmDescription,
								npmDescriptionSource,
								"origami.json and package.json descriptions should be the same"
							)
							.opinion()
					)
				}
			}
		}

		return node
	} else {
		return expected.string(description, descriptionSource).problem()
	}
}

export let ORIGAMI_TYPE = {
	COMPONENT: "component",
} as const

export type OrigamiTypeValue = typeof ORIGAMI_TYPE[keyof typeof ORIGAMI_TYPE]

export interface OrigamiType extends Node {
	type: "origami type"
	value: OrigamiTypeValue
}

let origamiType: NodeCreator<Required<OrigamiType>> = ({
	getBower,
	getNpm,
	getOrigami,
}) => {
	let {value: origamiType, source: origamiTypeSource} = getOrigami(
		"origamiType"
	)

	let validTypes = ["module", "component"]

	if (typeof origamiType == "string" && validTypes.includes(origamiType)) {
		let node = {
			source: origamiTypeSource,
			type: "origami type" as const,
			value: "component" as const,
			opinions: [] as Opinion[],
		}

		if (origamiType == "module") {
			node.opinions = [
				expected
					.value("component", "module", origamiTypeSource, "can be component")
					.opinion(),
			]
		}

		return node
	} else {
		return expected.member(validTypes, origamiType, origamiTypeSource).problem()
	}
}

export interface Keyword extends Node {
	type: "keyword"
	value: string
}

export interface Keywords extends Node {
	type: "keywords"
	children: Required<Keyword>[]
}

let keywords: NodeCreator<Required<Keywords>> = ({getOrigami}) => {
	let {value: keywords, source: keywordsSource} = getOrigami("keywords")
	if (Array.isArray(keywords)) {
		let node = {
			type: "keywords" as const,
			source: keywordsSource,
			children: [] as Required<Keyword>[],
		}
		keywords.forEach((_, index) => {
			let {value: keyword, source: keywordSource} = getOrigami(
				"keywords",
				index
			)
			if (typeof keyword == "string") {
				node.children.push(string("keyword", keyword, keywordSource) as Keyword)
			} else {
				node.children.push(expected.string(keyword, keywordSource).problem())
			}
		})
		return node
	} else {
		return expected.array(keywords, keywordsSource).problem()
	}
}

export let BRAND_NAME = {
	MASTER: "master",
	INTERNAL: "internal",
	WHITELABEL: "whitelabel",
} as const

let BRAND_VALUES = Object.values(BRAND_NAME)

export type BrandName = typeof BRAND_NAME[keyof typeof BRAND_NAME]

export interface Brand extends Node, Value<string> {
	type: "brand"
}

export interface Brands extends Node {
	type: "brands"
	master: boolean
	internal: boolean
	whitelabel: boolean
	children: Required<Brand>[]
}

let brands: NodeCreator<Optional<Brands>> = ({getOrigami, prefix}) => {
	let {value: brands, source: brandsSource} = prefix
		? getOrigami(...prefix, "brands")
		: getOrigami("brands")

	if (Array.isArray(brands)) {
		let node = {
			source: brandsSource,
			type: "brands" as const,
			master: false,
			whitelabel: false,
			internal: false,
			children: [] as Required<Brand>[],
		}

		brands.forEach((_, index) => {
			let {value: brand, source: brandSource} = getOrigami("brands", index)
			if (typeof brand == "string") {
				node.children.push(string("brand", brand, brandSource) as Brand)
			} else {
				node.children.push(expected.string(brand, brandSource).problem())
			}
		})

		return node
	} else if (brands == null) {
		return empty(brandsSource)
	} else {
		return expected.array(brands, brandsSource).problem()
	}
}

export let CATEGORY_NAME = {
	COMPONENTS: "components",
	PRIMITIVES: "primitives",
	UTILITIES: "utilities",
	LAYOUTS: "layouts",
}

export type CategoryName = typeof CATEGORY_NAME[keyof typeof CATEGORY_NAME]

let CATEGORY_VALUES = Object.values(CATEGORY_NAME)

export interface Category extends Node {
	type: "category"
	components: boolean
	primitives: boolean
	utilities: boolean
	layouts: boolean
	value: CategoryName
}

let category: NodeCreator<Required<Category>> = ({
	getBower,
	getNpm,
	getOrigami,
}) => {
	let {value: category, source} = getOrigami("origamiCategory")

	if (typeof category == "string" && CATEGORY_VALUES.includes(category)) {
		return {
			source,
			type: "category",
			components: category == CATEGORY_NAME.COMPONENTS,
			primitives: category == CATEGORY_NAME.PRIMITIVES,
			utilities: category == CATEGORY_NAME.UTILITIES,
			layouts: category == CATEGORY_NAME.LAYOUTS,
			value: category,
		}
	} else {
		return expected.member(CATEGORY_VALUES, category, source).problem()
	}
}

export let STATUS = {
	ACTIVE: "active",
	MAINTAINED: "maintained",
	DEPRECATED: "deprecated",
	DEAD: "dead",
	EXPERIMENTAL: "experimental",
}

export type StatusValue = typeof STATUS[keyof typeof STATUS]

export let STATUS_VALUES = Object.values(STATUS)

export interface Status extends Node {
	type: "status"
	active: boolean
	maintained: boolean
	deprecated: boolean
	dead: boolean
	experimental: boolean
	value: StatusValue
}

let status: NodeCreator<Required<Status>> = ({
	getBower,
	getNpm,
	getOrigami,
}) => {
	let {value: status, source} = getOrigami("supportStatus")

	if (typeof status == "string" && STATUS_VALUES.includes(status)) {
		return {
			source,
			type: "status",
			active: status == STATUS.ACTIVE,
			maintained: status == STATUS.MAINTAINED,
			deprecated: status == STATUS.DEPRECATED,
			dead: status == STATUS.DEAD,
			experimental: status == STATUS.EXPERIMENTAL,
			value: status,
		}
	} else {
		return expected.member(STATUS_VALUES, status, source).problem()
	}
}

import * as url from "url"

export interface Url extends Node, Value<url.Url> {
	type: "url"
}

export interface Email extends Node, Value<string> {
	type: "email"
}

export interface SlackContact extends Node {
	type: "slack contact"
	workspace: string
	channel: string
	value: string
}

let supportUrl: NodeCreator<Required<Url>> = ({getOrigami}) => {
	let {value: support, source} = getOrigami("support")
	if (typeof support != "string") {
		return expected.string(support, source).problem()
	}
	try {
		return {
			source,
			type: "url",
			value: url.parse(support),
		}
	} catch {
		return expected.url(support, source).problem()
	}
}

let supportEmail: NodeCreator<Required<Email>> = ({getOrigami}) => {
	let {value: email, source} = getOrigami("supportContact", "email")
	if (typeof email != "string") {
		return expected.string(email, source).problem()
	}

	let emailRegex = /^[^@]+@[^@]+$/
	let ftEmailRegex = /@ft.com$/
	if (emailRegex.test(email)) {
		if (ftEmailRegex.test(email)) {
			return {source, type: "email", value: email}
		} else {
			return {
				source,
				type: "email",
				value: email,
				opinions: [expected.match(ftEmailRegex, email, source).opinion()],
			}
		}
	} else {
		return expected.match(emailRegex, email, source).problem()
	}
}

let supportSlack: NodeCreator<Required<SlackContact>> = ({getOrigami}) => {
	let {value: slack, source} = getOrigami("supportContact", "slack")
	if (typeof slack != "string") {
		return expected.string(slack, source).problem()
	}
	let slackRegex = /([a-z0-9]+)\/(.*)/
	let match = slackRegex.exec(slack)
	if (match) {
		return {
			source,
			type: "slack contact",
			workspace: match[1],
			channel: match[2],
			value: slack,
		}
	} else {
		return expected.match(slackRegex, slack, source).problem()
	}
}

export interface BrowserFeature extends Node, Value<string> {
	type: "browser feature"
}

export interface BrowserFeatures extends Node {
	type: "browser features"
	optional: Required<BrowserFeature>[]
	required: Required<BrowserFeature>[]
}

let browserFeatures: NodeCreator<Optional<BrowserFeatures>> = ({
	getOrigami,
}) => {
	let browserFeaturesPath = "browserFeatures"
	let {value: browserFeatures, source} = getOrigami(browserFeaturesPath)

	if (browserFeatures == null) {
		return empty(source)
	}

	if (!isObject(browserFeatures)) {
		return expected
			.object(
				browserFeatures,
				source,
				"should be an object like: {optional: [], required: []}"
			)
			.problem()
	}

	let problems = []

	let node = {
		source,
		type: "browser features",
		optional: [],
		required: [],
	} as BrowserFeatures

	for (let key in browserFeatures) {
		if (key == "optional" || key == "required") {
			let {value: list, source} = getOrigami(browserFeaturesPath, key)

			if (Array.isArray(list)) {
				node[key] = list.map((element, index) => {
					return string(
						"browser feature",
						element,
						getOrigami("browserFeatures", key, index).source
					) as Required<BrowserFeature>
				})
			} else {
				return expected.array(list, source).problem()
			}
		} else {
			problems.push(
				expected
					.member(
						["optional", "required"],
						key,
						getOrigami(browserFeaturesPath, key).source,
						"unexpected key. should be an object like: {required: [], optional: []}"
					)
					.problem()
			)
		}
	}

	if (problems.length) {
		return {
			source,
			type: "problems",
			children: problems,
		}
	} else {
		return node
	}
}

export interface Map<T> extends Node {
	type: "map"
	value: {[key: string]: T}
}

export interface DemoTemplate extends Node, Value<string> {
	type: "demo template"
}

export interface DemoJavaScript extends Node, Value<string> {
	type: "demo javascript"
}

export interface DemoSass extends Node, Value<string> {
	type: "demo sass"
}

// TODO read the file into this if it's a file
export interface DemoData extends Node {
	type: "demo data"
	data: {[key: string]: any}
}

export interface DemoBase {
	/** the path to the demo-specific mustache template to render */
	template: Optional<DemoTemplate>
	/** the path to the Sass file to compile */
	sass: Optional<DemoSass>
	/** the JS file to build. */
	js: Optional<DemoJavaScript>
	/** path or object containing data to populate the template with */
	data: Optional<DemoData>
	/** CSS classes to set on the `html` tag. */
	documentClasses: Optional<Value<String>>
	/** a list of components required by the demo, to be loaded via the Build Service */
	dependencies: Optional<Value<string[]>>
}

export interface Demo extends DemoBase, Node {
	type: "demo"
	/** the index of the demo in the demos list */
	index: number
	/** Demo name which will be used as the name of the outputted html file */
	name: Required<Value<String>>
	/** A title for the demo which will appear when listed in the Registry */
	title: Required<Value<String>>
	/** An explanation of the purpose of the demo */
	description: Required<Value<String>>
	brands: Optional<Brands>
	// these two are optional in the spec, but they'll never be empty only false or true
	hidden: Required<Value<Boolean>>
	displayHtml: Required<Value<Boolean>>
}

export interface DemosDefaults extends DemoBase, Node {
	type: "demos defaults"
}

export interface Demos extends Parent<Optional<Demo>> {
	type: "demos"
	defaults: Optional<DemosDefaults>
}

// TODO clean this up, lots of duplication (and between this and demosDefaults)
// TODO fall back to default if it is not set here
let demo: AsyncNodeCreator<Optional<Demo>> = async ({
	getOrigami,
	prefix,
	component,
	...nco
}) => {
	if (!prefix) {
		throw new Error("must pass prefix option to demos")
	}

	let index = prefix[prefix.length - 1]

	if (typeof index != "number") {
		throw new Error("last item in prefix must be a demo index")
	}

	let node: Partial<Demo> = {
		type: "demo",
	}

	let {value: demo, source: demoSource} = getOrigami(...prefix)

	if (!demo) {
		return expected
			.object(demo, demoSource, "expected every item in the array to be a demo")
			.problem()
	}

	// TODO fallback everything to defaults

	let js = getOrigami(...prefix, "js")

	if (js.value) {
		if (typeof js.value == "string") {
			let jsPathType = await getPathType(js.value)
			if (jsPathType == "file") {
				node.js = {
					type: "demo javascript",
					source: js.source,
					value: js.value,
				}
			} else {
				node.js = expected.file(js.value, js.source).problem()
			}
		} else {
			node.js = expected.file(js.value, js.source).problem()
		}
	} else {
		node.js = empty(js.source)
	}

	let sass = getOrigami(...prefix, "sass")

	if (sass.value) {
		if (typeof sass.value == "string") {
			let sassPathType = await getPathType(sass.value)
			if (sassPathType == "file") {
				node.sass = {
					type: "demo sass",
					source: sass.source,
					value: sass.value,
				}
			} else {
				node.sass = expected.file(sass.value, sass.source).problem()
			}
		} else {
			node.sass = expected.file(sass.value, sass.source).problem()
		}
	} else {
		node.sass = empty(sass.source)
	}

	let template = getOrigami(...prefix, "template")

	if (template.value) {
		if (typeof template.value == "string") {
			let templatePathType = await getPathType(template.value)
			if (templatePathType == "file") {
				node.template = {
					type: "demo template",
					source: template.source,
					value: template.value,
				}
			} else {
				node.template = expected.file(template.value, template.source).problem()
			}
		} else {
			node.template = expected.file(template.value, template.source).problem()
		}
	} else {
		node.template = empty(template.source)
	}

	let data = getOrigami(...prefix, "data")

	if (data.value) {
		if (typeof data.value == "string") {
			let dataPathType = await getPathType(data.value)
			if (dataPathType == "file") {
				node.data = {
					type: "demo data",
					source: data.source,
					// TODO handle this better than just crashing if the data file is bad json
					data: JSON.parse(await fs.readFile(data.value, "utf-8")),
				}
			} else {
				node.data = expected.file(data.value, data.source).problem()
			}
		} else if (isObject(data.value)) {
			node.data = {
				type: "demo data",
				source: data.source,
				data: data.value,
			}
		} else {
			node.data = expected.file(data.value, data.source).problem()
		}
	} else {
		node.data = empty(data.source)
	}

	let documentClasses = getOrigami(...prefix, "documentClasses")

	if (documentClasses.value) {
		if (typeof documentClasses.value == "string") {
			node.documentClasses = string(
				"demo document classes",
				documentClasses.value,
				documentClasses.source
			)
		} else {
			node.documentClasses = expected
				.string(documentClasses.value, documentClasses.source)
				.problem()
		}
	} else {
		node.documentClasses = empty(documentClasses.source)
	}

	let dependencies = getOrigami(...prefix, "dependencies")

	if (dependencies.value) {
		if (Array.isArray(dependencies.value)) {
			if (dependencies.value.every(s => typeof s == "string")) {
				node.dependencies = {
					type: "demo dependencies",
					value: dependencies.value as string[],
					source: dependencies.source,
				}
			} else {
				node.dependencies = expected
					.array(
						dependencies.value,
						dependencies.source,
						"expected an array of strings"
					)
					.problem()
			}
		} else {
			node.dependencies = expected
				.array(
					dependencies.value,
					dependencies.source,
					"expected an array of strings"
				)
				.problem()
		}
	} else {
		node.dependencies = empty(dependencies.source)
	}

	// TODO this and the 3 after it are the same
	let title = getOrigami(...prefix, "title")
	if (typeof title.value == "string") {
		node.title = string("demo title", title.value, title.source) as Value<
			String
		>
	} else {
		node.title = expected.string(title.value, title.source).problem()
	}

	let name = getOrigami(...prefix, "name")
	if (typeof name.value == "string") {
		node.name = string("demo name", name.value, name.source) as Value<String>
	} else {
		node.name = expected.string(name.value, name.source).problem()
	}

	let description = getOrigami(...prefix, "description")
	if (typeof description.value == "string") {
		node.description = string(
			"demo description",
			description.value,
			description.source
		) as Value<String>
	} else {
		node.description = expected
			.string(description.value, description.source)
			.problem()
	}

	let {value: brandsValue, source: brandsSource} = getOrigami(
		...prefix,
		"brands"
	)

	if (brandsValue) {
		if (Array.isArray(brandsValue)) {
			let rootBrands = component.brands
			// TODO warn the user if they have not demo'd one of the brands
			if (rootBrands && rootBrands.type == "brands") {
				let brandsNode = brands({getOrigami, prefix, component, ...nco})
				let rootBrandsNames = rootBrands.children.map(b => {
					return b.type == "brand" && b.value
				})
				if (brandsNode.type == "brands") {
					if (
						(brandsNode.master && !rootBrands.master) ||
						(brandsNode.internal && !rootBrands.internal) ||
						(brandsNode.whitelabel && !rootBrands.whitelabel)
					) {
						node.brands = expected
							.member(rootBrandsNames, brandsValue, brandsSource)
							.problem()
					} else {
						node.brands = brandsNode
					}
				} else {
					node.brands = brandsNode
				}
			} else {
				node.brands = expected
					.message(
						brandsSource,
						"demo brands have been specified, but there are no brands listed in the manifest root"
					)
					.problem()
			}
		} else {
			node.brands = expected.array(brandsValue, brandsSource).problem()
		}
	} else {
		node.brands = empty(brandsSource)
	}

	// TODO this is exactly same as hidden
	// TODO deal with user using camelCase by accident
	let displayHtml = getOrigami(...prefix, "display_html")

	if (displayHtml.value == null) {
		node.displayHtml = {
			type: "demo display html",
			value: false,
			source: displayHtml.source,
		}
	} else if (typeof displayHtml.value == "boolean") {
		node.displayHtml = {
			type: "demo display html",
			value: displayHtml.value,
			source: displayHtml.source,
		}
	} else if (
		typeof displayHtml.value == "string" &&
		(displayHtml.value == "true" || displayHtml.value == "false")
	) {
		node.displayHtml = {
			type: "demo display html",
			value: displayHtml.value == "true" ? true : false,
			source: displayHtml.source,
			opinions: [
				expected
					.boolean(
						displayHtml.value,
						displayHtml.source,
						`should be an actual boolean, got the string "${displayHtml.value}"`
					)
					.opinion(),
			],
		}
	} else {
		node.displayHtml = expected
			.boolean(displayHtml.value, displayHtml.source)
			.problem()
	}

	let hidden = getOrigami(...prefix, "hidden")
	if (hidden.value == null) {
		node.hidden = {
			type: "demo display html",
			value: false,
			source: hidden.source,
		}
	} else if (typeof hidden.value == "boolean") {
		node.hidden = {
			type: "demo hidden",
			value: hidden.value,
			source: hidden.source,
		}
	} else if (
		typeof hidden.value == "string" &&
		(hidden.value == "true" || hidden.value == "false")
	) {
		node.hidden = {
			type: "demo hidden",
			value: hidden.value == "true" ? true : false,
			source: hidden.source,
			opinions: [
				expected
					.boolean(
						hidden.value,
						hidden.source,
						`should be an actual boolean, got the string "${hidden.value}"`
					)
					.opinion(),
			],
		}
	} else {
		node.hidden = expected.boolean(hidden.value, hidden.source).problem()
	}
	let demoNode: Demo = {
		type: "demo",
		template: node.template,
		sass: node.sass,
		js: node.js,
		data: node.data,
		brands: node.brands,
		documentClasses: node.documentClasses,
		dependencies: node.dependencies,
		index,
		source: demoSource,
		name: node.name,
		title: node.title,
		description: node.description,
		hidden: node.hidden,
		displayHtml: node.displayHtml,
	}

	return demoNode
}

// TODO consider cleaning this up a bit, lots of duplication
let demosDefaults: AsyncNodeCreator<Optional<DemosDefaults>> = async ({
	getOrigami,
}) => {
	let node: Partial<DemosDefaults> = {
		type: "demos defaults",
	}

	let {value: demosDefaults, source: demosDefaultsSource} = getOrigami(
		"demosDefaults"
	)

	node.source = demosDefaultsSource

	if (!demosDefaults) {
		return empty(demosDefaultsSource)
	}

	let js = getOrigami("demosDefaults", "js")

	if (js.value) {
		if (typeof js.value == "string") {
			let jsPathType = await getPathType(js.value)
			if (jsPathType == "file") {
				node.js = {
					type: "demo javascript",
					source: js.source,
					value: js.value,
				}
			} else {
				node.js = expected.file(js.value, js.source).problem()
			}
		} else {
			node.js = expected.file(js.value, js.source).problem()
		}
	} else {
		node.js = empty(js.source)
	}

	let sass = getOrigami("demosDefaults", "sass")

	if (sass.value) {
		if (typeof sass.value == "string") {
			let sassPathType = await getPathType(sass.value)
			if (sassPathType == "file") {
				node.sass = {
					type: "demo sass",
					source: sass.source,
					value: sass.value,
				}
			} else {
				node.sass = expected.file(sass.value, sass.source).problem()
			}
		} else {
			node.sass = expected.file(sass.value, sass.source).problem()
		}
	} else {
		node.sass = empty(sass.source)
	}

	let template = getOrigami("demosDefaults", "template")

	if (template.value) {
		if (typeof template.value == "string") {
			let templatePathType = await getPathType(template.value)
			if (templatePathType == "file") {
				node.template = {
					type: "demo template",
					source: template.source,
					value: template.value,
				}
			} else {
				node.template = expected.file(template.value, template.source).problem()
			}
		} else {
			node.template = expected.file(template.value, template.source).problem()
		}
	} else {
		node.template = empty(template.source)
	}

	let data = getOrigami("demosDefaults", "data")

	if (data.value) {
		if (typeof data.value == "string") {
			let dataPathType = await getPathType(data.value)
			if (dataPathType == "file") {
				node.data = {
					type: "demo data",
					source: data.source,
					// TODO handle this better than just crashing if the data file is bad json
					data: JSON.parse(await fs.readFile(data.value, "utf-8")),
				}
			} else {
				node.data = expected.file(data.value, data.source).problem()
			}
		} else if (isObject(data.value)) {
			node.data = {
				type: "demo data",
				source: data.source,
				data: data.value,
			}
		} else {
			node.data = expected.file(data.value, data.source).problem()
		}
	} else {
		node.data = empty(data.source)
	}

	let documentClasses = getOrigami("demosDefaults", "documentClasses")

	if (documentClasses.value) {
		if (typeof documentClasses.value == "string") {
			node.documentClasses = string(
				"demo document classes",
				documentClasses.value,
				documentClasses.source
			)
		} else {
			node.documentClasses = expected
				.string(documentClasses.value, documentClasses.source)
				.problem()
		}
	} else {
		node.documentClasses = empty(documentClasses.source)
	}

	let dependencies = getOrigami("demosDefaults", "dependencies")

	if (dependencies.value) {
		if (Array.isArray(dependencies.value)) {
			if (dependencies.value.every(s => typeof s == "string")) {
				node.dependencies = {
					type: "demo dependencies",
					value: dependencies.value as string[],
					source: dependencies.source,
				}
			} else {
				node.dependencies = expected
					.array(
						dependencies.value,
						dependencies.source,
						"expected an array of strings"
					)
					.problem()
			}
		} else {
			node.dependencies = expected
				.array(
					dependencies.value,
					dependencies.source,
					"expected an array of strings"
				)
				.problem()
		}
	} else {
		node.dependencies = empty(dependencies.source)
	}

	let demoNode: DemosDefaults = {
		type: "demos defaults",
		template: node.template,
		sass: node.sass,
		js: node.js,
		data: node.data,
		documentClasses: node.documentClasses,
		dependencies: node.dependencies,
		source: node.source,
	}

	return demoNode
}

let demos: AsyncNodeCreator<Optional<Demos>> = async options => {
	let {getOrigami} = options

	let demos = getOrigami("demos")

	let node = {
		type: "demos" as const,
		defaults: await demosDefaults(options),
		source: demos.source,
		children: [] as Optional<Demo>[],
	}

	if (demos.value) {
		if (Array.isArray(demos.value)) {
			for (let index = 0; index < demos.value.length; index++) {
				node.children.push(await demo({...options, prefix: ["demos", index]}))
			}
		} else {
			return expected.array(demos.value, demos.source).problem()
		}
	}

	return node
}

export interface Component extends Node {
	type: "component"
	origamiType: Required<OrigamiType>
	origamiVersion: Required<OrigamiVersion>
	brands: Optional<Brands>
	category: Required<Category>
	name: Required<Name>
	description: Required<Description>
	status: Required<Status>
	keywords: Required<Keywords>
	ci: Optional<Problem>
	browserFeatures: Optional<BrowserFeatures>
	entries: {
		javascript: Optional<JavaScriptEntry>
		sass: Optional<SassEntry>
	}
	support: {
		url: Required<Url>
		email: Required<Email>
		slack: Required<SlackContact>
	}
	demos: Optional<Demos>
	dependencies: {}
	opinions: Opinion[]
}

import {promises as fs} from "fs"

function po(expectation: Expectation.Any, source: Source, message?: string) {
	return {
		problem: () => problem(expectation, source, message),
		opinion: () => opinion(expectation, source, message),
	}
}

let expected = {
	message(source: Source, message: string) {
		return po(Expectation.message(), source, message)
	},
	type(
		expected: Expectation.TypeOfType[],
		received: JsonValueU,
		source: Source,
		message?: string
	) {
		return po(Expectation.typeOf(expected, received), source, message)
	},
	match(
		regexp: RegExp,
		received: JsonValueU,
		source: Source,
		message?: string
	) {
		return po(Expectation.match(regexp, received), source, message)
	},
	startsWith(
		expectedPrefix: string,
		received: JsonValueU,
		source: Source,
		message?: string
	) {
		return po(Expectation.startsWith(expectedPrefix, received), source, message)
	},
	string(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.typeOf(["string"], received), source, message)
	},
	boolean(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.typeOf(["boolean"], received), source, message)
	},
	array(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.typeOf(["array"], received), source, message)
	},
	number(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.typeOf(["number"], received), source, message)
	},
	object(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.typeOf(["object"], received), source, message)
	},
	file(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.file(received), source, message)
	},
	url(received: JsonValueU, source: Source, message?: string) {
		return po(Expectation.url(received), source, message)
	},
	value(
		expected: JsonValue,
		received: JsonValueU,
		source: Source,
		message?: string
	) {
		return po(Expectation.valueOf(expected, received), source, message)
	},
	member(
		list: JsonValue[],
		received: JsonValueU,
		source: Source,
		message?: string
	) {
		return po(Expectation.memberOf(list, received), source, message)
	},
}

type PathType =
	| "unavailable"
	| "file"
	| "directory"
	| "block device"
	| "character device"
	| "link"
	| "fifo"
	| "socket"
	| "unknown"

let getPathType = async (path: string): Promise<PathType> => {
	return fs
		.stat(path)
		.then(file => {
			if (file.isFile()) {
				return "file"
			} else if (file.isDirectory()) {
				return "directory"
			} else if (file.isBlockDevice()) {
				return "block device"
			} else if (file.isCharacterDevice()) {
				return "character device"
			} else if (file.isSymbolicLink()) {
				return "link"
			} else if (file.isFIFO()) {
				return "fifo"
			} else if (file.isSocket()) {
				return "socket"
			} else {
				// i don't know what this means
				return "unknown"
			}
		})
		.catch(() => {
			// this could mean we don't have permissions, or that it's not there
			return "unavailable"
		})
}

let path: AsyncValueNodeCreator<Required<Node>> = async function path(
	nodeType,
	path,
	source
): Promise<Required<Node>> {
	let node = {
		type: nodeType,
		source,
		value: path,
	}

	if (typeof path != "string") {
		return expected.string(path, source).problem()
	}

	return getPathType(path).then(type => {
		if (type == "file") {
			return node
		} else {
			return expected.file(path, source, `is ${type}`).problem()
		}
	})
}

interface JavaScriptEntry extends Node, Value<string> {
	type: "main.js"
}

interface SassEntry extends Node, Value<string> {
	type: "main.scss"
}

let entry = async <EntryNode extends Node>(
	nodeType: NodeType,
	entryPath: string,
	{getBower}: NodeCreatorOptions
): Promise<Optional<EntryNode>> => {
	let {value: bowerMain, source: bowerMainSource} = getBower("main")

	let mainEntryFileType = await getPathType(entryPath)
	let isFile = mainEntryFileType == "file"
	let isMissing = mainEntryFileType == "unavailable"

	if (isFile) {
		if (typeof bowerMain == "string") {
			if (bowerMain == entryPath) {
				return {
					// TODO
					// @ts-ignore
					type: nodeType,
					source: bowerMainSource,
					value: entryPath,
				}
			}
		} else if (Array.isArray(bowerMain)) {
			for (let index = 0; index < bowerMain.length; index++) {
				if (bowerMain[index] == entryPath) {
					return {
						// TODO
						// @ts-ignore
						type: nodeType,
						source: getBower("main", index).source,
						value: entryPath,
					}
				}
			}
		}

		return expected
			.value(
				entryPath,
				bowerMain,
				bowerMainSource,
				"a main.js file existed, so must be mentioned in bower.json#main"
			)
			.problem()
	} else if (isMissing) {
		if (typeof bowerMain == "string") {
			if (bowerMain == entryPath) {
				return expected
					.value(
						null,
						entryPath,
						bowerMainSource,
						"a main.js file did NOT exist, so should not be mentioned"
					)
					.problem()
			}
		} else if (Array.isArray(bowerMain)) {
			for (let index = 0; index < bowerMain.length; index++) {
				if (bowerMain[index] == entryPath) {
					return expected
						.value(
							null,
							entryPath,
							getBower("main", index).source,
							"a main.js file did NOT exist, so should not be mentioned"
						)
						.problem()
				}
			}
		} else {
			return empty(bowerMainSource)
		}
	} else {
		// TODO bowerMainSource is not correct here
		return expected
			.file(entryPath, bowerMainSource, `is ${mainEntryFileType}`)
			.problem()
	}

	return empty(bowerMainSource)
}

interface JavaScriptEntry extends Node, Value<string> {
	type: "main.js"
}

export async function createComponentNode(
	read: (path: string) => Promise<string>
): Promise<Required<Component>> {
	let bowerManifest: Manifest.Bower
	let origamiManifest: Manifest.Origami
	let npmManifest: Manifest.Npm | false = false
	let component = {
		type: "component",
	} as Component

	let bowerJson: string
	let origamiJson: string
	let packageJson: string | undefined = undefined

	// if these aren't here, it's unrecoverable
	// TODO consider returning Problem instead
	origamiJson = await read("origami.json")
	origamiManifest = JSON.parse(origamiJson)

	bowerJson = await read("bower.json")
	bowerManifest = JSON.parse(bowerJson)

	// this is fine to be missing
	// TODO consider returning Opinion instead
	packageJson = await read("package.json").catch()

	if (!packageJson) {
		component.opinions.push({
			type: "opinion",
			expectation: {
				type: "file",
				received: "package.json",
			},
			source: {
				file: "package.json",
				path: [],
				value: null,
			},
		})
	}

	// but if it exists and is invalid, it's unrecoverable
	// TODO consider returning Problem instead
	if (packageJson) {
		npmManifest = JSON.parse(packageJson)
	} else {
		npmManifest = false
	}

	let getOrigami = get<Manifest.Origami>(
		"origami.json",
		origamiJson,
		origamiManifest
	)
	let getBower = get<Manifest.Bower>("bower.json", bowerJson, bowerManifest)
	let getNpm =
		packageJson && npmManifest
			? get<Manifest.Npm>("package.json", packageJson, npmManifest)
			: undefined

	let options: NodeCreatorOptions = {
		getBower,
		getNpm,
		getOrigami,
		component,
	}

	let validOrigamiKeys = [
		"description",
		"origamiType",
		"origamiVersion",
		"brands",
		"keywords",
		"origamiCategory",
		"supportStatus",
		"support",
		"supportContact",
		"email",
		"slack",
		"ci",
		"browserFeatures",
		"required",
		"optional",
		"demosDefaults",
		"template",
		"sass",
		"js",
		"data",
		"documentClasses",
		"dependencies",
		"demos",
	]

	let thisManifestKeys = Object.keys(origamiManifest)

	for (let key in thisManifestKeys) {
		if (!validOrigamiKeys.includes(key)) {
		}
	}

	component.origamiVersion = origamiVersion(options)

	component.origamiType = origamiType(options)

	component.brands = brands(options)

	component.category = category(options)

	component.name = name(options)

	component.description = description(options)

	component.status = status(options)

	component.keywords = keywords(options)

	component.browserFeatures = browserFeatures(options)

	if (origamiManifest.ci) {
		component.ci = expected
			.value(null, origamiManifest.ci, {
				file: "origami.json",
				value: origamiManifest.ci,
				path: ["ci"],
			})
			.problem()
	}

	component.entries = {
		javascript: await entry<JavaScriptEntry>("main.js", "main.js", options),
		sass: await entry<SassEntry>("main.scss", "main.scss", options),
	}

	component.support = {
		url: supportUrl(options),
		email: supportEmail(options),
		slack: supportSlack(options),
	}

	component.demos = await demos(options)

	return component
}
