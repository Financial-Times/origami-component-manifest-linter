import * as url from "url"
import {promises as fs} from "fs"

import * as Expectation from "./expectation"
import get, {Source, GetPath} from "./get"
import type * as Manifest from "./manifest"
import type {Get, ValueSource} from "./get"
import type {JsonValueU, JsonValue} from "./json-value"
import {isObject} from "./json-value"

/** An object containing all the valid node type values **/
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

/**
 * a type of NodeType which gets its values from the object of node types.
 * this lets us write functions that take a `NodeType` as an argument.
 */
export type NodeType = typeof NODE_TYPE[keyof typeof NODE_TYPE]

/**
 * The base node from which other nodes extend.
 * abstract.
 */
export interface Node {
	/** a type from the set of valid node types */
	type: NodeType
	/**
	 * a source object as defined in `get.ts`.

	 * these provide the file, json path, line and column where a piece of
	 * information orignated
	 */
	source: Source
	/**
	 * a list of failed expectations that are not fatal, but for which we
	 * might provide some helpful insights
	 */
	opinions?: Opinion[]
}

/**
 * a node that represents a raw value.
 * designed for holding literals like
 * booleans or strings, but could contain anything
 */
export interface Value<ValueType> extends Node {
	value: ValueType
}

/**
 * A template node is a node that does not yet have its nodetype defined.
 *
 * These are useful when reducing duplication by building up a common node shape
 * in a function and then setting its `type` after the fact.
 */
type TemplateNode<Target extends Node> = Omit<Target, "type">

/**
 * Functions that return a node are called "node creators". Every one of them
 * gets called with the same set of options.
 */
interface NodeCreatorOptions {
	/**
	 * a function that returns a value from the bower.json matching a json
	 * path
	 */
	getBower: Get
	/**
	 * a function that returns a value from the package.json matching a json
	 * path. if there is no package.json, this will not be defined.
	 */
	getNpm?: Get
	/**
	 * a function that returns a value from the origami.json matching a json
	 * path.
	 */
	getOrigami: Get
	/**
	 * The component so far. Some nodes may rely on the parsed value of others.
	 */
	component: Partial<Component>
	/**
	 *  a path that should be prepended to the getters, for children to use
	 */
	prefix?: GetPath
}

/**
 * Functions that create a node are called "node creators".
 */
type NodeCreator<Node> = (options: NodeCreatorOptions) => Node

/**
 * Functions that create a node are called "node creators".
 * async node creators return a promise that resolves to a Node
 */
type AsyncNodeCreator<Node> = (options: NodeCreatorOptions) => Promise<Node>

/**
 * Mark a node as Required, which means it can only be the node or a problem.
 */
type Required<N> = N | Problem | Problems

/**
 * Mark a node as Required, which means it can be the node, a problem or the
 * empty node
 */
type Optional<N> = Empty | N | Problem | Problems

/**
 * A node that has children.
 */
export interface Parent<Item extends Node> extends Node {
	children: Item[]
}

/**
 * A representation for when something optional was not present in the
 *  manifests.
 */
export interface Empty extends Node {
	type: "empty"
}

/**
 * Create a node representing an optional property that was not present in the
 * manifests
 *
 * @param {Source} source the source at which nothing was found
 * @returns {Empty} the empty node
 */
function empty(source: Source): Empty {
	return {
		type: "empty",
		source,
	}
}

/** An abstract node for problem and opinions */
export interface Information extends Node {
	/** the expectation that failed */
	expectation: Expectation.Any
	/** the error code */
	code: string
	/** an extra informative message */
	message?: string
}

/** a problem child. a fatal expectation failure when trying to parse a value */
export interface Problem extends Information, Node {
	type: "problem"
}

/** a problem parent */
export interface Problems extends Parent<Problem>, Node {
	type: "problems"
}

/** create a problem */
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

/** a non-fatal expectation failure when trying to parse a value */
export interface Opinion extends Information, Node {
	type: "opinion"
}

/** opine */
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

/**
 * Create a helper that has a .problem and .opinion method to create a problem
 * or opinion from any failed expectation
 *
 * @param expectation the expectation that failed
 * @param source the file position information for the failure
 * @param message a string containing an extra helpful message in addition to
 * the expectation failure
 */
function po(expectation: Expectation.Any, source: Source, message?: string) {
	return {
		problem: (code: string) => problem(expectation, source, code, message),
		opinion: (code: string) => opinion(expectation, source, code, message),
	}
}

/**
 * A set of helpers for failed expectations.
 */
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

/**
 * A node representing the version of Origami the component implements
 */
export interface OrigamiVersion extends Node, Value<number> {
	type: "origami version"
}

/**
 * Create node representing the version of Origami the component implements
 */
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

/**
 * A node representing the component's name, parsed from the bower.json and, if
 * there is one, the package.json
 */
export interface Name extends Value<string> {
	type: "name"
}

/**
 * Create a {@link Name} node.
 * TODO: check the environment variables for GITHUB_REPOSITORY and make sure the
 * name matches
 */
let name: NodeCreator<Required<Name>> = ({getBower, getNpm}) => {
	let problems = {
		type: NODE_TYPE.PROBLEMS,
		children: [] as Problem[],
	} as Problems

	// get the name from bower.json
	let {value: bowerName, source: bowerNameSource} = getBower("name")

	if (typeof bowerName == "string") {
		// https://origami.ft.com/spec/v1/components/#naming-conventions
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
			// *should* be prefixed with o- (for Origami).
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

			// we're going to error if the npm name is not the same
			// as the one in bower.json
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
				// but we don't mind if there is no npm manifest at all
				return node
			}
		} else {
			// The name *must* only contain lower-case ASCII letters, and hyphens.
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
			expected.string(bowerName, bowerNameSource).problem("name-not-string")
		)
	}

	return problems
}

/** A node representing a description of the component */
export interface Description extends Value<string> {
	type: "description"
}

/** Create a {@link Description} node */
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

		// the description should be the same in bower, npm and origami
		// manifests
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

/** map of valid origamiTypes for the final tree. there is only one */
export let ORIGAMI_TYPE = {
	COMPONENT: "component",
} as const

/** type of valid origamiType */
export type OrigamiTypeValue = typeof ORIGAMI_TYPE[keyof typeof ORIGAMI_TYPE]

/** A node representing the origamiType */
export interface OrigamiType extends Value<OrigamiTypeValue> {
	type: "origami type"
	value: OrigamiTypeValue
}

/** Create a {@link OrigamiType} node */
let origamiType: NodeCreator<Required<OrigamiType>> = ({getOrigami}) => {
	let {value: origamiType, source: origamiTypeSource} = getOrigami(
		"origamiType"
	)

	// we will optionally accept `module`
	// https://origami.ft.com/spec/v1/manifest/#origamitype
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

/** A node representing a single keyword */
export interface Keyword extends Node {
	type: "keyword"
	value: string
}

/** A node representing the keywords array */
export interface Keywords extends Node {
	type: "keywords"
	children: Required<Keyword>[]
}

/**
 * Create a {@link Keywords} node
 * TODO accept a comma separated string and return an opinion
 */
let keywords: NodeCreator<Required<Keywords>> = ({getOrigami}) => {
	let {value: keywords, source: keywordsSource} = getOrigami("keywords")
	// https://origami.ft.com/spec/v1/manifest/#keywords
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

/**
 * A map of valid brand names
 */
export let BRAND_NAME = {
	MASTER: "master",
	INTERNAL: "internal",
	WHITELABEL: "whitelabel",
} as const

/** a valid brand name */
export type BrandName = typeof BRAND_NAME[keyof typeof BRAND_NAME]

/** A node representing a brand */
export interface Brand extends Value<string> {
	type: "brand"
}

/**
 * A node representing the brands array.
 *
 * Contains the brands as children, as well as a boolean for each known brand,
 * indicating whether it is present in the array.
 */
export interface Brands extends Node {
	type: "brands"
	master: boolean
	internal: boolean
	whitelabel: boolean
	children: Required<Brand>[]
}

/**
 * Create a brands node.
 */
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

/**
 * map of valid category names
 */
export let CATEGORY_NAME = {
	COMPONENTS: "components",
	PRIMITIVES: "primitives",
	UTILITIES: "utilities",
	LAYOUTS: "layouts",
}

/**
 * a valid category
 */
export type CategoryName = typeof CATEGORY_NAME[keyof typeof CATEGORY_NAME]

/**
 * the category names
 */
let CATEGORY_VALUES = Object.values(CATEGORY_NAME)

/**
 * A node representing the category.
 *
 * Contains the category as value, as well as a boolean for each known category,
 * indicating whether it is the component's category
 */
export interface Category extends Value<CategoryName> {
	type: "category"
	components: boolean
	primitives: boolean
	utilities: boolean
	layouts: boolean
}

/**
 * Create a category node.
 */
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

/**
 * map of valid statuses
 */
export let STATUS = {
	ACTIVE: "active",
	MAINTAINED: "maintained",
	DEPRECATED: "deprecated",
	DEAD: "dead",
	EXPERIMENTAL: "experimental",
}

/**
 * A valid status
 */
export type StatusValue = typeof STATUS[keyof typeof STATUS]

/**
 * The valid status values
 */
export let STATUS_VALUES = Object.values(STATUS)

/**
 * A node representing the status.
 *
 * Contains the status as value, as well as a boolean for each known status,
 * indicating whether it is the component's status
 */
export interface Status extends Value<StatusValue> {
	type: "status"
	active: boolean
	maintained: boolean
	deprecated: boolean
	dead: boolean
	experimental: boolean
}

/**
 * Create a status node.
 */
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

/** a node representing a component's support url */
export interface Url extends Value<url.Url> {
	type: "url"
}

/** a node representing a component's support email */
export interface Email extends Value<string> {
	type: "email"
}

/**
 * a node representing a component's support slack channel
 *
 * It has the `workspace/channel` as a value as well as `.workspace` and
 * `.channel` properties with their parsed values.
 */
export interface SlackContact extends Node {
	type: "slack contact"
	workspace: string
	channel: string
	value: string
}

/** create a Url node */
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

/** create a support Email node */
let supportEmail: NodeCreator<Required<Email>> = ({getOrigami}) => {
	let {value: email, source} = getOrigami("supportContact", "email")
	if (typeof email != "string") {
		return expected.string(email, source).problem("support-email-not-string")
	}

	let emailRegex = /^[^@]+@[^@]+$/
	let ftEmailRegex = /@ft.com$/

	// it's a problem if it's not a valid email address, which we're
	// defining as something@something
	if (emailRegex.test(email)) {
		// it's our opinion the email should be on the ft.com domain
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

/** create a support Slack node */
let supportSlack: NodeCreator<Required<SlackContact>> = ({getOrigami}) => {
	let {value: slack, source} = getOrigami("supportContact", "slack")
	if (typeof slack != "string") {
		return expected.string(slack, source).problem("support-slack-not-string")
	}

	// https://origami.ft.com/spec/v1/manifest/#supportcontact
	// this *must* be in the format organization/channelname
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

/** A node representing a browser feature */
export interface BrowserFeature extends Value<string> {
	type: "browser feature"
}

/** A node representing the browser features */
export interface BrowserFeatures
	extends Node,
		Parent<Required<BrowserFeature>> {
	type: "browser features"
	optional: Required<BrowserFeature>[]
	required: Required<BrowserFeature>[]
}

/**
 * create a browser features node
 *
 * TODO check that these are valid polyfill library features
 */
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
		children: [],
	}

	for (let key in browserFeatures) {
		if (key == "optional" || key == "required") {
			let {value: list, source} = getOrigami(browserFeaturesPath, key)

			if (Array.isArray(list)) {
				node[key] = list.map((element, index) => {
					let source = getOrigami("browserFeatures", key, index).source
					if (typeof element == "string") {
						// TODO check that the browser
						// feature is a valid polyfill feature
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
		let result: BrowserFeatures = {
			source,
			type: "browser features",
			optional: node.optional || [],
			required: node.required || [],
			children: [],
		}

		result.children = [...result.optional, ...result.required]

		return result
	}
}

/** a node representing the template file name for a demo */
export interface DemoTemplate extends Node, Value<string> {
	type: "demo template"
}

/** a node representing the javascript file name for a demo */
export interface DemoJavaScript extends Node, Value<string> {
	type: "demo javascript"
}

/** a node representing the sass file name for a demo */
export interface DemoSass extends Node, Value<string> {
	type: "demo sass"
}

/** a value node representing the data for a demo */
export interface DemoData extends Value<{[key: string]: any}> {
	type: "demo data"
}

/**
 * an abstract node representing the properties present in both demo defaults
 * and individual demos
 */
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

/**
 * a node representing the demo defaults
 *
 * this is a parent so it is easier to iterate
 */
export interface DemosDefaults extends DemoBase, Node, Parent<Node> {
	type: "demos defaults"
}

/**
 * a node representing an individual demo
 *
 * this is a parent so it is easier to iterate
 */
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

/**
 * a node representing the demos array
 */
export interface Demos extends Parent<Optional<Demo>> {
	type: "demos"
	defaults: Optional<DemosDefaults>
}

/** create a demo base, for use in demos and demo defaults */
async function demoBase({
	getOrigami,
	prefix,
}: NodeCreatorOptions): Promise<Optional<DemoBase>> {
	let node: Partial<DemoBase> = {}
	if (!prefix) {
		throw new Error("demoBase must be called with a prefix opion")
	}

	let {value: demoValue, source: demoSource} = getOrigami(...prefix)

	node.source = demoSource

	if (!demoValue) {
		return empty(demoSource)
	}

	let js = getOrigami(...prefix, "js")

	if (js.value) {
		if (typeof js.value == "string") {
			// we make sure a named javascript file is truly a file
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
			// we make sure a named sass file is truly a file
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
		// data might be a file path or an object
		if (typeof data.value == "string") {
			// we make sure a named data file is truly a file
			let dataPathType = await getPathType(data.value)
			if (dataPathType == "file") {
				node.data = {
					type: "demo data",
					source: data.source,
					// we expect a named data file to be
					// json, and parse it.
					// TODO handle this better than crashing if the data file is bad json
					value: JSON.parse(await fs.readFile(data.value, "utf-8")),
				}
			} else {
				node.data = expected
					.file(data.value, data.source)
					.problem("demo-data-bad-file")
			}
		} else if (isObject(data.value)) {
			// if it's an object, we take it directly. might be
			node.data = {
				type: "demo data",
				source: data.source,
				value: data.value,
			}
		} else {
			node.data = expected
				.file(data.value, data.source)
				.problem("demo-data-not-file-or-object")
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
		source: node.source,
	}

	return demoNode
}

/**
 * try to create a boolean value node from a boolean or a boolean string.
 *
 * if it's a boolean string (i.e. the string `"true"` or the string `"false"`)
 * we warn, but parse it anyway
 */
function boolean({
	value,
	source,
}: ValueSource): Required<TemplateNode<Value<boolean>>> {
	if (value == null) {
		return {
			value: false,
			source,
		}
	} else if (typeof value == "boolean") {
		return {
			value,
			source,
		}
	} else if (
		typeof value == "string" &&
		(value == "true" || value == "false")
	) {
		let booleanStringOpinion = expected
			.boolean(
				value,
				source,
				`should be an actual boolean, got the string "${value}"`
			)
			.opinion("boolean-string")
		return {
			value: value == "true" ? true : false,
			source: source,
			opinions: [booleanStringOpinion],
		}
	} else {
		return expected.boolean(value, source).problem("not-a-boolean")
	}
}

/**
 * try to create a string value node
 */
function string({
	value,
	source,
}: ValueSource): Required<TemplateNode<Value<string>>> {
	if (typeof value == "string") {
		return {
			value,
			source,
		}
	} else {
		return expected.string(value, source).problem("not-string")
	}
}

/**
 * create a demo node
 *
 * NOTE this must be run after `brands` because it uses that information
 * TODO fall back to defaults
 */
let demo = async (
	{getOrigami, prefix, component, ...nodeCreatorOptions}: NodeCreatorOptions,
	_defaults: Optional<DemosDefaults>
): Promise<Optional<Demo>> => {
	if (!prefix) {
		throw new Error("must pass prefix option to demos")
	}

	let base = await demoBase({
		...nodeCreatorOptions,
		getOrigami,
		prefix,
		component,
	})

	// if it has a type, then that means it was `empty`, `problem` or
	// `problems` because demoBase does not provide a type
	if ("type" in base) {
		return base
	}

	let index = prefix[prefix.length - 1]

	// the prefix is used to drill down the origami.json to the correct
	// child of the demos array. if it isn't a number then we don't
	// understand what it means
	if (typeof index != "number") {
		throw new Error("last item in prefix must be a demo index")
	}

	let node: Partial<Demo> = {}

	// the type will be overridden if `string` caused a problem
	node.title = {
		type: "demo title",
		...string(getOrigami(...prefix, "title")),
	}

	// the type will be overridden if `string` caused a problem
	node.name = {
		type: "demo name",
		...string(getOrigami(...prefix, "name")),
	}

	// the type will be overridden if `string` caused a problem
	node.description = {
		type: "demo description",
		...string(getOrigami(...prefix, "description")),
	}

	let displayHtml = getOrigami(...prefix, "display_html")

	// the spec defines display_html as the sole snake-cased item in the
	// manifest. it would be understandable if the user camel-cased it by
	// accident, so we parse the camelCase version and warn them
	let displayHtmlCamelCased = getOrigami(...prefix, "displayHtml")
	let displayHtmlOpinions = []
	if (displayHtml.value == null && displayHtmlCamelCased.value != null) {
		displayHtmlOpinions.push(
			expected
				.message(
					displayHtmlCamelCased.source,
					"display_html should be snake-cased (sorry)"
				)
				.opinion("display-html-camel-case")
		)
		displayHtml = displayHtmlCamelCased
	}

	let displayHtmlResult = boolean(displayHtml)
	// because displayHtmlResult is a Required<TemplateNode>, we know that
	// if it has a type it is a `problem' or `problems'
	node.displayHtml =
		"type" in displayHtmlResult
			? displayHtmlResult
			: {
					type: "demo display html",
					value: displayHtmlResult.value,
					source: displayHtmlResult.source,
					opinions: displayHtmlResult.opinions
						? displayHtmlOpinions.concat(displayHtmlResult.opinions)
						: displayHtmlOpinions,
			  }

	let hidden = getOrigami(...prefix, "hidden")
	let hiddenResult = boolean(hidden)

	// because hiddendResult is a Required<TemplateNode>, we know that
	// if it has a type it is a `problem' or `problems'
	node.hidden =
		"type" in hiddenResult
			? hiddenResult
			: {
					type: "demo hidden",
					value: hiddenResult.value,
					source: hiddenResult.source,
					opinions: hiddenResult.opinions,
			  }

	let {value: brandsValue, source: brandsSource} = getOrigami(
		...prefix,
		"brands"
	)

	if (brandsValue) {
		if (Array.isArray(brandsValue)) {
			let componentBrandsNode = component.brands
			if (componentBrandsNode && componentBrandsNode.type == "brands") {
				let demoBrandsNode = brands({
					getOrigami,
					prefix,
					component,
					...nodeCreatorOptions,
				})

				let componentBrandsNodeNames = componentBrandsNode.children.map(b => {
					return b.type == "brand" && b.value
				})

				if (demoBrandsNode.type == "brands") {
					// it's a problem if we are demoing a brand
					// that is not listed as a brand
					// implemented by this component
					if (
						(demoBrandsNode.master && !componentBrandsNode.master) ||
						(demoBrandsNode.internal && !componentBrandsNode.internal) ||
						(demoBrandsNode.whitelabel && !componentBrandsNode.whitelabel)
					) {
						node.brands = expected
							.member(componentBrandsNodeNames, brandsValue, brandsSource)
							.problem("brand-not-valid")
					} else {
						// a problem
						node.brands = demoBrandsNode
					}
				} else {
					// a problem
					node.brands = demoBrandsNode
				}
			} else {
				// a problem
				node.brands = expected
					.message(
						brandsSource,
						"demo brands have been specified, but there are no brands listed in the manifest root"
					)
					.problem("demo-brands-not-supported")
			}
		} else {
			// a problem
			node.brands = expected
				.array(brandsValue, brandsSource)
				.problem("demo-brands-not-array")
		}
	} else {
		// brands is optional!!
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

let demosDefaults: AsyncNodeCreator<Optional<
	DemosDefaults
>> = async nodeCreatorOptions => {
	let prefix = nodeCreatorOptions.prefix
		? [...nodeCreatorOptions.prefix, "demosDefaults"]
		: ["demosDefaults"]

	let base = await demoBase({...nodeCreatorOptions, prefix})

	if (
		"type" in base &&
		(base.type == "empty" || base.type == "problem" || base.type == "problems")
	) {
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
				node.children.push(
					await demo({...options, prefix: ["demos", index]}, node.defaults)
				)
			}
		} else {
			return expected
				.array(demos.value, demos.source)
				.problem("demos-not-array")
		}
	}

	// TODO warn the user if they have not demo'd one of the
	// brands mentioned in the origami.json#brands field
	return node
}

/** things filesystem paths can point at */
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

/**
 * sniff a filesystem path and return what it is
 *
 * @param path the target path
 */
let getPathType = async (path: string): Promise<PathType> => {
	return fs
		.stat(path)
		.then(file => {
			if (file.isFile()) {
				// an ordinary file
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
				// i don't know what this could mean. might be impossible
				return "unknown"
			}
		})
		.catch(() => {
			// this could mean we don't have permissions, or that it's not there
			return "unavailable"
		})
}

/** a node representing the component's javascript entry point */
interface JavaScriptEntry extends Value<string> {
	type: "main.js"
}

/** a node representing the component's sass entry point */
interface SassEntry extends Value<string> {
	type: "main.scss"
}

/**
 * create a node representing a component's entry point (sass or javascript)
 *
 * this is called for "main.js" and "main.scss" whether or not those are mentioned
 * in bower.json or they exist in the filesystem because we want to catch the
 * mistake that only one of those is the case.
 */
let entry = async (
	entryPath: string,
	{getBower}: NodeCreatorOptions
): Promise<Optional<TemplateNode<Value<string>>>> => {
	let {value: bowerMain, source: bowerMainSource} = getBower("main")

	let mainEntryFileType = await getPathType(entryPath)
	let isFile = mainEntryFileType == "file"
	let isMissing = mainEntryFileType == "unavailable"
	let fileSource

	// bower's .main can be a string or an array
	// we look for the file there
	if (typeof bowerMain == "string") {
		if (bowerMain == entryPath) {
			fileSource = bowerMainSource
		}
	} else if (Array.isArray(bowerMain)) {
		for (let index = 0; index < bowerMain.length; index++) {
			if (bowerMain[index] == entryPath) {
				fileSource = getBower("main", index).source
			}
		}
	}

	if (isFile) {
		if (fileSource) {
			return {
				source: fileSource,
				value: entryPath,
			}
		}

		// if the file is on the disk, it's a problem that we don't
		// mention it in bower.main
		return expected
			.value(
				entryPath,
				bowerMain,
				bowerMainSource,
				"a main.js file existed, so must be mentioned in bower.json#main"
			)
			.problem("unreferenced-existing-main-js")
	} else if (isMissing) {
		// if the file was not on the disk it's a problem if we
		// mention it in bower.main
		if (fileSource) {
			return expected
				.value(
					null,
					entryPath,
					fileSource,
					"a main.js file did NOT exist, so should not be mentioned"
				)
				.problem("referenced-missing-main-js")
		} else {
			return empty(bowerMainSource)
		}
	} else {
		// if there was something in bower.main that wasn't a file path,
		// that's a problem
		return expected
			.file(entryPath, fileSource || bowerMainSource, `is ${mainEntryFileType}`)
			.problem("non-file-main")
	}
}

/** A node representing a whole component */
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

/** create a {@link Component} node */
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

	let javascript = await entry("main.js", options)
	let sass = await entry("main.scss", options)

	component.entries = {
		javascript:
			// if it ran into any trouble, type will be defined by `empty'
			// or `problem'`
			"type" in javascript
				? javascript
				: {
						source: javascript.source,
						value: javascript.value,
						type: "main.js",
				  },
		sass:
			"type" in sass
				? sass
				: {
						source: sass.source,
						value: sass.value,
						type: "main.scss",
				  },
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
		// we pass all these through as children too, to make iteration easier
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
