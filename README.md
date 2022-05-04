# Wollok-TS-CLI

Wollok Command Line Interface


## Usage

If you are looking at this, you are probably interested in how to use this project from a developer's point of view (for a user's point of view, please run the client with the `--help` argument to see all options).

After checking-out the project run `npm install` to download all dependencies. You can run the CLI by running `npm start`. Use the `--help` flag to see all available commands and options.

Remember that, while running through npm, you will need to add a `--` before any non npm related flags. For example you can run `npm start -- --help` to see the application manual.

To build the CLI executables for distribution run `npm run build` and check the `/dist` folder.

### Available Commands

This is the list of the currently available commands:

- **run < program >**: Runs a Wollok program on the target project.
- **test [ filter ]**: Runs Wollok tests on the target project.
- **repl < auto-import >**: Opens the Wollok REPL on the target project importing the auto-import path (if any).

## Contributing

All contributions are welcome! Feel free to report issues on [the project's issue tracker](https://github.com/uqbar-project/wollok-ts-cli/issues), or fork the project and [create a *Pull Request*](https://help.github.com/articles/creating-a-pull-request-from-a-fork/). If you've never collaborated with an open source project before, you might want to read [this guide](https://akrabat.com/the-beginners-guide-to-contributing-to-a-github-project/).

If you plan to contribute with code, here are some hints to help you start:


### Working Environment

Before anything else, you will need a *TypeScript* editor. We recomend [Visual Studio Code](https://code.visualstudio.com/) along with the following plugins:

- [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)
- [TypeScript Importer](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Move TS](https://marketplace.visualstudio.com/items?itemName=stringham.move-ts)
- [Wollok Highlight](https://marketplace.visualstudio.com/items?itemName=uqbar.wollok-highlight)


### Node

You need to install [node](https://nodejs.org/es/) > 11, which provides VM environment, and [nvm - Node Version Manager](https://github.com/nvm-sh/nvm). Before anything make sure you'll use the right version of node by running this command:

```bash
nvm use
```

Expected output is the node version that will be used, for example:

```bash
Found '/home/dodain/workspace/wollok-dev/wollok-ts/.nvmrc' with version <v11.15.0>
Now using node v11.15.0 (npm v6.7.0)
```

### NPM

You will also need to install [NPM](https://www.npmjs.com/). (Node.js version 8 or greater) If you are not familiar with *dependency manager tools*, you can think of this program as the entry point for all the important tasks development-related tasks, like installing dependencies and running tests. After installing the client, go to the project root folder and run:

```bash
# This will install all the project dependencies. Give it some time.
npm install
```

After that, you are ready to start working. You can **run the tests and style checks** by typing:

```bash
# This will run tests for all the modules. Try to do this often and avoid commiting changes if any test fails.
npm test
```