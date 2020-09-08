let tap = require("tap")
let fs = require("fs").promises
let {resolve: resolvePath} = require("path")
let execa = require("execa")
let {getProblemsAndOpinions} = require("../cjs")

/**
 * @typedef PrettyProblemInfo
 * @property {string} file
 * @property {number} line
 * @property {number} column
 * @property {(string|number)[]} path
 */

/**
 * @typedef {Object.<string, PrettyProblemInfo>} PrettyProblems
 */

/**
 * @param {import("../src/lib/node").Problem[] | import("../src/lib/node").Opinion[]} nodes
 * @returns {PrettyProblems}
 */
function pretty(nodes) {
	/** @type {PrettyProblems} */
	let map = {}

	for (let node of nodes) {
		map[node.code] = {
			line: node.source.start && node.source.start.line,
			column: node.source.start && node.source.start.column,
			file: node.source.file,
			path: node.source.path,
		}
	}
	return map
}

/** @param {import("execa").ExecaReturnValue} result */
function parse(result) {
	let opm
	try {
		opm = JSON.parse(result.stdout)
	} catch (error) {
		console.log(result.stdout.split("\n")[0])
	}
	let problems = []
	let opinions = []
	for (let node of getProblemsAndOpinions(opm)) {
		if (node.type == "problem") {
			problems.push(node)
		} else if (node.type == "opinion") {
			opinions.push(node)
		} else {
			tap.fail("getProblemsAndOpinions should only yield problems and opinions")
		}
	}

	if (problems.length || opinions.length) {
		return {
			problems: pretty(problems),
			opinions: pretty(opinions),
		}
	} else {
		return {perfect: true}
	}
}

/** @param {string} testName */
async function test(testName) {
	let testDirectory = resolvePath(__dirname, testName)
	let expectedFile = resolvePath(testDirectory, "expected.json")
	let expected = JSON.parse(await fs.readFile(expectedFile))

	let componentDirectory = resolvePath(testDirectory, "component")

	let actual = parse(
		await execa(
			"node",
			[resolvePath(__dirname, ".."), componentDirectory, "opm"],
			{
				cwd: componentDirectory,
				env: {
					FORCE_COLOR: 0,
					NODE_ENV: "inner-test",
				},
			}
		)
	)

	tap.test(testName, t => {
		t.strictDeepEqual(expected, actual)
		t.done()
	})
}

let all = (list, fn) => Promise.all(list.map(fn))

fs.readdir(__dirname).then(async filenames => {
	await all(filenames, filename => {
		if (filename == "test.js") {
			return
		}

		return test(filename)
	})
})
