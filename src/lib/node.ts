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
	/** a path that should be prepended to any gets, for children to use */
	prefix?: GetPath
}

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

export interface OrigamiVersion extends Node, Value<number> {
	type: "origami version"
}

let origamiVersion: NodeCreator<Required<OrigamiVersion>> = ({getOrigami}) => {
	let {value, source} = getOrigami("origamiVersion")
	if (typeof value == "number") {
		return {
			type: "origami version",
			source,
			value,
		}
	} else {
		return expected
			.number(value, source)
			.problem("origami-version-not-a-number")
	}
}

export interface Information extends Node {
	expectation: Expectation.Any
	/** the error code */
	code: string
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
	code: string,
	message?: string
): Problem {
	return {
		type: "problem",
		expectation,
		source,
		code,
		message,
	}
}

export interface Opinion extends Information, Node {
	type: "opinion"
}

export function opinion(
	expectation: Expectation.Any,
	source: Source,
	code: string,
	message?: string
): Opinion {
	return {
		type: "opinion",
		expectation,
		source,
		code,
		message,
	}
}

type Required<N> = N | Problem | Problems

type Optional<N> = Empty | N | Problem | Problems

export interface Name extends Node, Value<string> {
	type: "name"
}

let name: NodeCreator<Required<Name>> = ({getBower, getNpm}) => {
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
						.opinion("non-o-prefix")
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
						expected
							.value(bowerName, npmName, npmNameSource)
							.problem("bower-npm-names-no-match")
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
					.problem("name-not-ascii")
			)
		}
	} else {
		problems.children.push(
			expected.string(bowerName, bowerNameSource).problem("no-bower-name")
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
						.opinion("bower-origami-description-no-match")
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
							.opinion("npm-origami-description-no-match")
					)
				}
			}
		}

		return node
	} else {
		return expected
			.string(description, descriptionSource)
			.problem("description-not-string")
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

let origamiType: NodeCreator<Required<OrigamiType>> = ({getOrigami}) => {
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
					.opinion("origami-type-is-module"),
			]
		}

		return node
	} else {
		return expected
			.member(validTypes, origamiType, origamiTypeSource)
			.problem("origami-type-not-valid")
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
				node.children.push({
					type: "keyword",
					value: keyword,
					source: keywordSource,
				})
			} else {
				node.children.push(
					expected.string(keyword, keywordSource).problem("keyword-not-string")
				)
			}
		})
		return node
	} else {
		return expected
			.array(keywords, keywordsSource)
			.problem("keywords-not-array")
	}
}

export let BRAND_NAME = {
	MASTER: "master",
	INTERNAL: "internal",
	WHITELABEL: "whitelabel",
} as const

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
				node.children.push({
					type: "brand",
					value: brand,
					source: brandSource,
				})
			} else {
				node.children.push(
					expected.string(brand, brandSource).problem("brand-not-string")
				)
			}
		})

		return node
	} else if (brands == null) {
		return empty(brandsSource)
	} else {
		return expected.array(brands, brandsSource).problem("brands-not-array")
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

let category: NodeCreator<Required<Category>> = ({getOrigami}) => {
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
		return expected
			.member(CATEGORY_VALUES, category, source)
			.problem("category-not-valid")
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

let status: NodeCreator<Required<Status>> = ({getOrigami}) => {
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
		return expected
			.member(STATUS_VALUES, status, source)
			.problem("status-not-valid")
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
		return expected.string(support, source).problem("support-not-string")
	}
	try {
		return {
			source,
			type: "url",
			value: url.parse(support),
		}
	} catch {
		return expected.url(support, source).problem("support-not-url")
	}
}

let supportEmail: NodeCreator<Required<Email>> = ({getOrigami}) => {
	let {value: email, source} = getOrigami("supportContact", "email")
	if (typeof email != "string") {
		return expected.string(email, source).problem("support-email-not-string")
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
				opinions: [
					expected
						.match(ftEmailRegex, email, source)
						.opinion("support-email-not-ft"),
				],
			}
		}
	} else {
		return expected
			.match(emailRegex, email, source)
			.problem("support-email-not-email")
	}
}

let supportSlack: NodeCreator<Required<SlackContact>> = ({getOrigami}) => {
	let {value: slack, source} = getOrigami("supportContact", "slack")
	if (typeof slack != "string") {
		return expected.string(slack, source).problem("support-slack-not-string")
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
		return expected
			.match(slackRegex, slack, source)
			.problem("support-slack-not-org-channel")
	}
}

export interface BrowserFeature extends Node, Value<string> {
	type: "browser feature"
}

export interface BrowserFeatures
	extends Node,
		Parent<Required<BrowserFeature>[]> {
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
			.problem("browser-features-not-object")
	}

	let problems = []

	let node: Partial<BrowserFeatures> = {
		optional: [],
		required: [],
	}

	for (let key in browserFeatures) {
		if (key == "optional" || key == "required") {
			let {value: list, source} = getOrigami(browserFeaturesPath, key)

			if (Array.isArray(list)) {
				node[key] = list.map((element, index) => {
					let source = getOrigami("browserFeatures", key, index).source
					if (typeof element == "string") {
						return {
							type: "browser feature",
							value: element,
							source,
						}
					} else {
						return expected
							.string(element, source)
							.problem("browser-feature-not-string")
					}
				})
			} else {
				problems.push(
					expected.array(list, source).problem("browser-feature-set-not-array")
				)
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
					.problem("browser-features-wrong-shape")
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
		return {
			source,
			type: "browser features",
			optional: node.optional || [],
			required: node.required || [],
			children: [node.optional || [], node.required || []],
		}
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
	source: Source
}

export interface Demo extends DemoBase, Node, Parent<Node> {
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

export interface DemosDefaults extends DemoBase, Node, Parent<Node> {
	type: "demos defaults"
}

export interface Demos extends Parent<Optional<Demo>> {
	type: "demos"
	defaults: Optional<DemosDefaults>
}

async function demoBase({getOrigami, prefix}: NodeCreatorOptions): Promise<Optional<DemoBase>> {
	let node: Partial<DemoBase> = {}
	if (!prefix) {
		throw new Error("demoBase must be called with a prefix opion")
	}

	let {value: demoValue, source: demoSource} = getOrigami(
		...prefix
	)

	node.source = demoSource

	if (!demoValue) {
		return empty(demoSource)
	}

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
				node.js = expected.file(js.value, js.source).problem("demo-js-not-file")
			}
		} else {
			node.js = expected.file(js.value, js.source).problem("demo-js-not-file")
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
				node.sass = expected
					.file(sass.value, sass.source)
					.problem("demo-sass-not-file")
			}
		} else {
			node.sass = expected
				.file(sass.value, sass.source)
				.problem("demo-sass-not-file")
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
				node.template = expected
					.file(template.value, template.source)
					.problem("demo-template-not-file")
			}
		} else {
			node.template = expected
				.file(template.value, template.source)
				.problem("demo-template-not-file")
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
					// TODO handle this better than crashing if the data file is bad json
					data: JSON.parse(await fs.readFile(data.value, "utf-8")),
				}
			} else {
				node.data = expected
					.file(data.value, data.source)
					.problem("demo-data-bad-file")
			}
		} else if (isObject(data.value)) {
			node.data = {
				type: "demo data",
				source: data.source,
				data: data.value,
			}
		} else {
			node.data = expected
				.file(data.value, data.source)
				.problem("demo-data-not-file")
		}
	} else {
		node.data = empty(data.source)
	}

	let documentClasses = getOrigami(...prefix, "documentClasses")

	if (documentClasses.value) {
		if (typeof documentClasses.value == "string") {
			node.documentClasses = {
				type: "demo document classes",
				value: documentClasses.value,
				source: documentClasses.source,
			}
		} else {
			node.documentClasses = expected
				.string(documentClasses.value, documentClasses.source)
				.problem("demo-classes-not-string")
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
					.problem("demo-deps-not-strings")
			}
		} else {
			node.dependencies = expected
				.array(
					dependencies.value,
					dependencies.source,
					"expected an array of strings"
				)
				.problem("demo-deps-not-array")
		}
	} else {
		node.dependencies = empty(dependencies.source)
	}

	let demoNode: DemoBase = {
		template: node.template,
		sass: node.sass,
		js: node.js,
		data: node.data,
		documentClasses: node.documentClasses,
		dependencies: node.dependencies,
		source: node.source
	}

	return demoNode
}

let demo: AsyncNodeCreator<Optional<Demo>> = async ({
	getOrigami,
	prefix,
	component,
	...nodeCreatorOptions
}) => {
	if (!prefix) {
		throw new Error("must pass prefix option to demos")
	}

	let base = await demoBase({...nodeCreatorOptions, getOrigami, prefix, component})

	if ("type" in base && (base.type == "empty" || base.type == "problem" || base.type == "problems")) {
		return base
	}


       let index = prefix[prefix.length - 1]

       if (typeof index != "number") {
               throw new Error("last item in prefix must be a demo index")
       }

	let node: Partial<Demo> = {}

	// TODO this and the 3 after it are the same
	let title = getOrigami(...prefix, "title")
	if (typeof title.value == "string") {
		node.title = {type: "demo title", value: title.value, source: title.source}
	} else {
		node.title = expected
			.string(title.value, title.source)
			.problem("demo-title-not-string")
	}

	let name = getOrigami(...prefix, "name")
	if (typeof name.value == "string") {
		node.name = {type: "demo name", value: name.value, source: name.source}
	} else {
		node.name = expected
			.string(name.value, name.source)
			.problem("demo-name-not-string")
	}

	let description = getOrigami(...prefix, "description")
	if (typeof description.value == "string") {
		node.description = {
			type: "demo description",
			value: description.value,
			source: description.source,
		}
	} else {
		node.description = expected
			.string(description.value, description.source)
			.problem("demo-description-not-string")
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
					.opinion("demo-display-html-is-boolean-string"),
			],
		}
	} else {
		node.displayHtml = expected
			.boolean(displayHtml.value, displayHtml.source)
			.problem("demo-display-html-not-boolean")
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
					.opinion("demo-hidden-is-boolean-string"),
			],
		}
	} else {
		node.hidden = expected
			.boolean(hidden.value, hidden.source)
			.problem("demo-hidden-not-boolean")
	}


      let {value: brandsValue, source: brandsSource} = getOrigami(
              ...prefix,
              "brands"
      )

      if (brandsValue) {
              if (Array.isArray(brandsValue)) {
                      let rootBrands = component.brands
                      // TODO warn the user if they have not demo'd one of the
		      // brands mentioned in the origami.json#brands field
                      if (rootBrands && rootBrands.type == "brands") {
                              let brandsNode = brands({getOrigami, prefix, component, ...nodeCreatorOptions})
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
                                                      .problem("brand-not-valid")
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
                                      .problem("demo-brands-not-supported")
                      }
              } else {
                      node.brands = expected
                              .array(brandsValue, brandsSource)
                               .problem("demo-brands-not-array")
               }
       } else {
               node.brands = empty(brandsSource)
       }

	let demoNode: Demo = {
		type: "demo",
		template: base.template,
		sass: base.sass,
		js: base.js,
		data: base.data,
		brands: node.brands,
		documentClasses: base.documentClasses,
		dependencies: base.dependencies,
		index,
		source: base.source,
		name: node.name,
		title: node.title,
		description: node.description,
		hidden: node.hidden,
		displayHtml: node.displayHtml,
		children: [
			base.template,
			base.sass,
			base.js,
			base.data,
			node.brands,
			base.documentClasses,
			node.name,
			node.title,
			node.description,
			node.hidden,
			node.displayHtml,
		],
	}

	return demoNode
}

let demosDefaults: AsyncNodeCreator<Optional<DemosDefaults>> = async (nodeCreatorOptions) => {
	let prefix = nodeCreatorOptions.prefix
		? [...nodeCreatorOptions.prefix, "demosDefaults"]
		: ["demosDefaults"]

	let base = await demoBase({...nodeCreatorOptions, prefix})

	if ("type" in base && (base.type == "empty" || base.type == "problem" || base.type == "problems")) {
		return base
	}

	let demoNode: DemosDefaults = {
		type: "demos defaults",
		template: base.template,
		sass: base.sass,
		js: base.js,
		data: base.data,
		documentClasses: base.documentClasses,
		dependencies: base.dependencies,
		source: base.source,
		children: [
			base.template,
			base.sass,
			base.js,
			base.data,
			base.documentClasses,
		],
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
			return expected
				.array(demos.value, demos.source)
				.problem("demos-not-array")
		}
	}

	return node
}

export interface Component extends Node, Parent<Node> {
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
	//dependencies: {}
	opinions: Opinion[]
}

import {promises as fs} from "fs"

function po(expectation: Expectation.Any, source: Source, message?: string) {
	return {
		problem: (code: string) => problem(expectation, source, code, message),
		opinion: (code: string) => opinion(expectation, source, code, message),
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
			.problem("unreferenced-existing-main-js")
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
					.problem("referenced-missing-main-js")
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
						.problem("referenced-missing-main-js")
				}
			}
		} else {
			return empty(bowerMainSource)
		}
	} else {
		// TODO bowerMainSource is not correct here
		return expected
			.file(entryPath, bowerMainSource, `is ${mainEntryFileType}`)
			.problem("non-file-main")
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
	let component: Partial<Component> = {
		type: "component",
	}
	component.opinions = [] as Opinion[]

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
			code: "no-package-json",
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

	for (let key of thisManifestKeys) {
		if (!validOrigamiKeys.includes(key)) {
			component.opinions.push({
				type: "opinion",
				message: `Invalid root-level key found: ${key}`,
				expectation: {
					type: "memberOf",
					list: validOrigamiKeys,
					received: key,
				},
				source: {
					file: "package.json",
					path: [key],
					value: null,
				},
				code: "origami-json-extra-keys",
			})
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
			.problem("ci")
	} else {
		component.ci = empty({
			file: "origami.json",
			path: ["ci"],
			value: undefined,
		})
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

	return {
		type: "component",
		source: {
			file: "origami.json",
			path: [],
			value: origamiJson,
		},
		opinions: component.opinions,
		origamiVersion: component.origamiVersion,
		origamiType: component.origamiType,
		brands: component.brands,
		category: component.category,
		name: component.name,
		description: component.description,
		status: component.status,
		keywords: component.keywords,
		browserFeatures: component.browserFeatures,
		ci: component.ci,
		entries: component.entries,
		support: component.support,
		demos: component.demos,
		children: [
			component.origamiVersion,
			component.origamiType,
			component.brands,
			component.category,
			component.name,
			component.description,
			component.status,
			component.keywords,
			component.browserFeatures,
			component.ci,
			component.entries.sass,
			component.entries.javascript,
			component.support.email,
			component.support.slack,
			component.support.url,
			component.demos,
		],
	}
}
