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
import {createComponentNode, Problem, Opinion} from "./lib/node"

import {promises as fs} from "fs"
import * as chalk from "chalk"
import {resolve as resolvePath} from "path"

function helpUrl(problem: Problem | Opinion): string | undefined {
	if (problem.source.file == "origami.json" && problem.source.path) {
		let manifestKey = problem.source.path[0]
		return `https://origami.ft.com/spec/v1/manifest/#${manifestKey}`
	}
	return undefined
}

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

	let e = problem.expectation

	// TODO deal with "message" expectations
	switch (e.type) {
		case "valueOf": {
			write(
				`expected value ${chalk.greenBright(
					e.expected
				)}, but got ${chalk.magentaBright(JSON.stringify(e.received))}`
			)
			break
		}
		case "memberOf": {
			write(
				`expected one of ${chalk.greenBright(
					e.list.join(chalk.white("|"))
				)}, but got ${chalk.magentaBright(`"${e.received}"`)}`
			)
			break
		}
		case "typeOf": {
			let expected = '"' + e.expected + '"'
			let received = '"' + typeof e.received + '"'
			write(
				`expected type ${chalk.greenBright(
					expected
				)}, but got ${chalk.magentaBright(received)}`
			)
			break
		}
		case "file": {
			write(chalk.magentaBright(e.received))
			write(" does not exist under ")
			write(chalk.grey(cwd))
			break
		}
	}

	let help = helpUrl(problem)
	if (help) {
		write("\n" + chalk.magenta("check " + help + " for help"))
	}

	write("\n\n")
}

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

	let option = process.argv[3]
	let read = (path: string) => fs.readFile(resolvePath(path), "utf-8")

	let component = await createComponentNode(read)

	if (option == "print") {
		process.stdout.write(JSON.stringify(component, null, "\t") + EOL)
		process.exit(0)
	}

	if (component.type == "problem") {
		print(component, cwd)
		process.exit(131)
	} else {
		// TODO write an actual walker
		walkObject(component, (node: any) => {
			if (
				node &&
				node.type &&
				(node.type == "problem" || node.type == "opinion")
			) {
				print(node, cwd)
			}
		})
	}
})()

// @ts-ignore
import * as walkObject from "object-walk"
