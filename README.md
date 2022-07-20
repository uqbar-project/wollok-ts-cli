# Wollok-TS-CLI

Wollok Command Line Interface

## Available Commands

Wollok Command Line Interface should be run **inside a Wollok project folder**. This folder is considered as the wollok target project.

This is the list of the currently available commands:

- **--help**: Shows the manual with all the options
- **run <program>**: Runs a Wollok program on the target project.
- **test \[filter\]**: Runs Wollok tests on the target project.
- **repl <auto-import>**: Opens the Wollok REPL on the target project importing the auto-import path (if any).

## Contributing

All contributions are welcome! Feel free to report issues on [the project's issue tracker](https://github.com/uqbar-project/wollok-ts-cli/issues), or fork the project and [create a *Pull Request*](https://help.github.com/articles/creating-a-pull-request-from-a-fork/). If you've never collaborated with an open source project before, you might want to read [this guide](https://akrabat.com/the-beginners-guide-to-contributing-to-a-github-project/).

If you plan to contribute with code, here are some hints to help you start:


### Working Environment

Before anything else, you will need a *TypeScript* editor. We recomend [Visual Studio Code](https://code.visualstudio.com/) along with the following plugins:

- [TSLint](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin)
- [TypeScript Importer](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Move TS](https://marketplace.visualstudio.com/items?itemName=stringham.move-ts)
- [Wollok Highlight](https://marketplace.visualstudio.com/items?itemName=uqbar.wollok-highlight)


### Node, npm, and dependencies

#### For Linux, MacOS:
  
You need to install [nvm - Node Version Manager](https://github.com/nvm-sh/nvm). 

Before anything make sure you'll use the right version of node by running this command:

```bash
nvm use
```

Expected output is the node version that will be used, for example:

```bash
Found '/home/you/wollok-ts-cli/.nvmrc' with version <lts/gallium>
Now using node v16.15.0 (npm v8.5.5)
```

#### For Windows:

You need to install the [NVM- for Windows](https://github.com/coreybutler/nvm-windows).

Run the installer `nvm-setup.exe` as Administrator.

Open an elevated Command Prompt or Git Bash in the project folder (with Administrator privileges) and run:

```bash
nvm install <<version number>>
nvm use <<version number>>
# The version number is in the .nvmrc file (do not use codename version e.g. lts/gallium, in Windows you have to use the equivalent version number e.g. 16.15.0)
```
  
#### For all:
 
In the previous step, `nvm use` also installs [NPM](https://www.npmjs.com/). If you are not familiar with *dependency manager tools*, you can think of this program as the entry point for all the important tasks development-related tasks, like installing dependencies and running tests. 
  
  
Expected output is the node version that will be used:
```bash
node -v
```
So now you need to use npm to install dependencies:

```bash
# This will install all the project dependencies. Give it some time.
npm install
```


### Running and testing

After that, you are ready to start working. You can build the project by running `npm run build`; this will compile all assets to the `/dist` folder, leaving everything ready to run but, **if you are a developer, you will probably want to run `npm run watch` instead and leave it running in a separate window so it will update the `/dist` folder whenever any code is changed** (notice that this only works for TS changes, to update any other kind of file you have to restart the watch).

Once the code has been built, you can **run the CLI** by running `npm start`. Remember that, while running through npm, you will need to add a `--` before any non npm related flags. For example, to see the application manual you can run 

```bash
npm start -- --help 
```

Another example, opening the repl on a certain file in a certain wollok project:

```bash
npm start -- repl /home/you/myWollokProject/birds.wlk -p /home/you/myWollokProject/
```

Finally, you can generate wollok-cli **executable binaries** (a.k.a. the distributable user-ready program) by running:

```bash
npm run pack
# If you're in Windows, run:
npm run pack:win
```

And checking the `/dist` folder.
