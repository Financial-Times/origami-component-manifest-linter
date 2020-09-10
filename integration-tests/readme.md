# integration tests

This folder contains a `test.js` file that provides a test runner, and a series
of directories that provide fixtures.

The components are stored in a structure like this:

```text
├── names-arent-the-same
│   ├── component
│   │   ├── bower.json
│   │   ├── origami.json
│   │   └── package.json
│   └── github.json
```

The `github.json` file contains a structure the same as what is created by the
parse functions above:

```json
{
	"errors": {
		"bower-npm-names-no-match" : {
			"file": "package.json",
			"line": 2,
			"col": 10
		}
	},
	"warnings": {}
}
```

In the test runner, we execute the cli on each of the `test-name/component`
directories, and create a [tap](https://node-tap.org/) test for each one,
checking that the parsed output matches the `expected.json` file and that
