# origami-component-manifest-linter

Run this tool in a component directory to get informative messages about
problems and improvements to the `origami.json`, `bower.json` and `package.json`
files.

## installation

This program is intended to be consumed as part of the [origami build
tools](https://github.com/Financial-Times/origami-build-tools) `verify` step.

Advanced and unsupported usage may be found in the [implementation details
section](#implementation-details) below

## implementation details

_the information in this section is subject to change**

### origami component model

The origami-component-manifest-linter is written in TypeScript, and most of the
work takes place in [node.ts](./src/lib/node.ts) file.

A model of the component is build up by reading the three component manifest
files, and any issues generating that model are returned in the form of Problem
and Opinion nodes.

### cli

```usage
origami-component-manifest-linter [path/to/component] [style]
```

The printer that lives in [index.ts](./src/index.ts** loops through and writes
those Problem and Opinion nodes in a human-readable format to stdout.

By default, the current working directory is expected to be the component
directory but a user can also provide the directory as an argument:

```sh
$ origami-component-manifest-linter ~/projects/o-typography
```

#### style

A second argument "may be passed to indicate the output style:

| style name | description                                                                           |
|:----------:|:-------------------------------------------------------------------------------------:|
| github     | outputs  in the  `::error`/`::warning` style used in github actions to annotate files |
| opm        | outputs the entire component model in json format                                     |

# Licence
MIT
