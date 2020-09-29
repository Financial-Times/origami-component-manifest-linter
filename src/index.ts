#!/usr/env/bin node
try {
	// point errors at typescript, not javascript!
	require("source-map-support").install()
} catch {}

process.on("unhandledRejection", error => {
	console.error(error)
	process.exit(131)
})

import {EOL} from "os"
import {
	createComponentNode,
	Problem,
	Opinion,
	Component,
	Node,
	NodeType,
	Parent,
	Problems,
} from "./lib/node"

import type * as Expectation from "./lib/expectation"
import {promises as fs} from "fs"
import * as chalk from "chalk"
import {resolve as resolvePath} from "path"

/**
 * Return a helpful url for problems that occurred in the origami.json.
 *
 * Each property of the manifest is documented in the specification so it's
 * easier to be helpful here.
 *
 * @param problem the problem or opinion we want a url for
 * @returns a url if the problem was for a property
in the origami.json
 */
function helpUrl(problem: Problem | Opinion): string | undefined {
	if (problem.source.file == "origami.json" && problem.source.path) {
		let manifestKey = problem.source.path[0]
		return `https://origami.ft.com/spec/v1/manifest/#${manifestKey}`
	}
	return undefined
}

/**
 * Turn an expectation into a helpful string.
 *
 * @param expectation the Expectation to report
 * @param cwd the working directory, for contextual information in `file`
 * expecations.
 *
 * @returns a helpful message for the user based on the type of expecation
 * failure
 */
function parseExpectation(expectation: Expectation.Any, cwd: string): string {
	switch (expectation.type) {
		case "valueOf": {
			return `expected value ${chalk.greenBright(
				expectation.expected
			)}, but got ${chalk.magentaBright(JSON.stringify(expectation.received))}`
		}
		case "memberOf": {
			return `expected one of ${chalk.greenBright(
				expectation.list.join(chalk.white("|"))
			)}, but got ${chalk.magentaBright(`"${expectation.received}"`)}`
		}
		case "typeOf": {
			let expected = '"' + expectation.expected + '"'
			let received = '"' + typeof expectation.received + '"'
			return `expected type ${chalk.greenBright(
				expected
			)}, but got ${chalk.magentaBright(received)}`
		}
		case "file": {
			return `${chalk.magentaBright(
				expectation.received
			)} does not exist under ${chalk.grey(cwd)}`
		}
	}
	return ""
}

/**
 * This provides the output used in github actions to annotate the files view in
 * PRs with line-by-line info.
 *
 * Side-effect only, no return.
 *
 * @param problem the problem that occurred
 * @param cwd the current workig directory, for context when printing about
 * files
 */
function githubPrint(problem: Problem | Opinion, cwd: string) {
	let write = process.stdout.write.bind(process.stdout)
	let severity = problem.type == "problem" ? "error" : "warning"
	write("::")
	write(severity)
	write(" ")
	write(`file=${problem.source.file},`)
	write(`code=${problem.code},`)
	if (problem.source.start) {
		write(`line=${problem.source.start.line},`)
		write(`col=${problem.source.start.column},`)
	}
	write(`severity=${severity}`)
	write("::")
	if (problem.message) {
		write(problem.message + "\t(")
	}
	write(parseExpectation(problem.expectation, cwd))
	if (problem.message) {
		write(")")
	}
	write("\n")
}

/**
 * This provides the output for command line users.
 * Side-effect only, no return.
 *
 * @param problem the problem that occurred
 * @param cwd the current workig directory, for context when printing about
 * files
 */
function print(problem: Problem | Opinion, cwd: string) {
	let sourcePath = cwd + problem.source.file
	let write = process.stdout.write.bind(process.stdout)
	write(chalk.cyan(sourcePath))
	if (problem.source.start) {
		let colon = () => write(":")
		colon()
		write(chalk.yellowBright(problem.source.start.line))
		colon()
		write(chalk.yellowBright(problem.source.start.column))
	}
	write("\n")

	if (problem.type == "problem") {
		write(chalk.red.bold("oh no "))
	} else if (problem.type == "opinion") {
		write(chalk.yellow.bold("btw "))
	}

	write(problem.source.file)
	write(chalk.grey("#"))

	if (problem.source.path) {
		let first = true
		for (let key of problem.source.path) {
			first = first ? false : (write(chalk.grey(".")), false)
			write(chalk.blue(key))
		}
	}

	if (problem.source.value) {
		write(" = ")
		write(chalk.red(JSON.stringify(problem.source.value)))
	}

	write(" " + chalk.yellow(problem.message || ""))

	write("\n")

	let help = helpUrl(problem)
	if (help) {
		write("\n" + chalk.magenta("check " + help + " for help") + "\n")
	}

	write("\n\n")
}

/**
 * Iterate through the component model, yielding problems and opinions.
 *
 * @param component the component model to iterate over. it may be an entire
 * problem if something fundamental went wrong.
 *
 * @yields problems and opinions in the model.
 */
export function* getProblemsAndOpinions(
	component: Component | Problem | Problems
): Generator<Opinion | Problem, void, undefined> {
	if ("opinions" in component && component.opinions) {
		yield* component.opinions
	}

	function* testNode(
		node: Node | Parent<Node>
	): Generator<Opinion | Problem, void, undefined> {
		if (node.type == "problem") {
			// WHY DO I HAVE TO DO THIS
			yield node as Problem
		}
		if (node.opinions) {
			yield* node.opinions
		}
		if ("children" in node) {
			for (let child of node.children) {
				yield* testNode(child)
			}
		}
	}

	yield* testNode(component)
}

// we run the command line interface only if this file is being executed directly
if (require.main === module) {
	void (async function () {
		let cwd = "./"
		let dir = process.argv[2]
		if (dir) {
			if (!dir.endsWith("/")) {
				dir += "/"
			}
			process.chdir(dir)
			cwd = dir
		}

		let style = process.argv[3]
		let read = (path: string) => fs.readFile(resolvePath(path), "utf-8")

		let component = await createComponentNode(read)

		if (style == "model") {
			process.stdout.write(JSON.stringify(component, null, "\t") + EOL)
			process.exit(0)
		}

		let printer = style == "github" ? githubPrint : print

		if (component.type == "problem" || component.type == "problems") {
			// ENOTRECOVERABLE
			process.exitCode = 131
		}

		for (let problemOrOpinion of getProblemsAndOpinions(component)) {
			printer(problemOrOpinion, cwd)
		}
	})()
}
