# Grid Core

# What is Grid?

[Ethereum Grid](https://grid.ethereum.org/) started as a desktop application that would allow users to easily download and configure binaries. It has since evolved into two projects: Grid Core (this repository) and [Grid](https://github.com/ethereum/grid).

## [Grid Core](https://github.com/PhilippLgh/grid-core) 
Grid core is is a secure execution environment that allows scripts to safely interact with binaries and even docker containers. It comes with many tools and helpers to configure binaries, spin up user interfaces and wire everything together into workflows that can be versioned and shared. Gird Core follows the infrastructure as code (IaC) philosophy where we use known software best practices and tools to design, implement, deploy and orchestrate application infrastructure. It comes with a command line interface (CLI) .

## [Grid](https://github.com/ethereum/grid) 
Grid is the desktop application that integrates with the OS and provides a simplified UI to make binaries, apps and workflows accessible to less technical people or just to have a more convenient access to Ethereum tools. Please note that both are still undergoing a refactoring and are under heavy development.

# Running the examples

Grid workflows are simple JavaScript files that are executed in a sandboxed runtime environment - without access to NPM modules but with access to Grid and some special API's. Please note that the constrained environment is **NOT a Protection Mechanism** since workflows can download and execute binaries and have other ways to bypass the sandbox.
For security concerns please refer to the section about scoped and signed packages.

To explore Grid workflows please checkout the [Grid Workflows](https://github.com/PhilippLgh/Grid-Workflows) repository.

All workflows in this repository can be executed with following schema:

`grid-core workflow run 0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/<name>@version`

`<name>` is the name as defined in the individual workflow package.json.
The `<version>` tag is optional and can be left out - default will be `latest`. 

### Without installation

I you have NPM installed and just want to try things out:
`npx grid-core run 0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/hello-grid`

is the perfect one-liner to get you started.

### With installation
If you want to write your own workflows or run more examples it makes sense to install the CLI tools:

```
npm install -g grid-core
or
yarn global add grid-core
```

### Run "Hello Grid"

`grid-core workflow run 0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/hello-grid`

```bash
  _____      _     _         _____ _      _____ 
 / ____|    (_)   | |       / ____| |    |_   _|
| |  __ _ __ _  __| |______| |    | |      | |  
| | |_ | '__| |/ _' |______| |    | |      | |  
| |__| | |  | | (_| |      | |____| |____ _| |_ 
 \_____|_|  |_|\__,_|       \_____|______|_____|
                                                
Grid Version 1.0.3

✔ Downloading client binaries from: https://7ssowu391m.execute-api.us-east-1.amazonaws.com/dev/storage/download/0x59054E7c69D42FCcA9CC2f7Fd0BE52db00152669/workflows/0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/public/hello-grid-1.0.0.tar.gz
✔ Downloaded binaries: 100%
✔ Workflow has a valid signature and the author(s) is trusted: ["0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9"]
Starting workflow:
=================================================
Name: hello-grid
Version: 1.0.0
Description: This workflow only prints 'hello-grid'.
=================================================
Output:
              
INFO : >> hello grid
=================================================
```

## Verify your security model

Now try to run an "unoffical" / untrusted fork of hello grid. Please note that the author has a different address.

`grid-core workflow run 0x988194bc7dad7882acb9a3bb5d27c484ad863fb5/hello-grid`

```bash
  _____      _     _         _____ _      _____ 
 / ____|    (_)   | |       / ____| |    |_   _|
| |  __ _ __ _  __| |______| |    | |      | |  
| | |_ | '__| |/ _' |______| |    | |      | |  
| |__| | |  | | (_| |      | |____| |____ _| |_ 
 \_____|_|  |_|\__,_|       \_____|______|_____|
                                                
Grid Version 1.0.3

✔ Downloading client binaries from: https://7ssowu391m.execute-api.us-east-1.amazonaws.com/dev/storage/download/0x59054E7c69D42FCcA9CC2f7Fd0BE52db00152669/workflows/0x988194bc7dad7882acb9a3bb5d27c484ad863fb5/public/hello-grid-1.0.0.tar.gz
✔ Downloaded binaries: 100%
⠋ Verifying workflow ...Error: Package was not signed by Grid author. Execution of hosted packages not-signed by a Grid author is currently disabled
    at WorkflowManager.<anonymous> (/../WorkflowManager.js:176:27)
```

The current security model is to reject execution of hosted packages that are not signed by a Grid author.
We will make adjustments to this model and allow more white listing options soon.

## Scoped and signed Packages
Grid has a strong concept of authorship and authentication. This is why every project name is scoped to an Ethereum address like:
`0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/ethers-repl@1.0.0`, usually owned by one individual or organization e.g a team.
This address is also the address that was used to sign the package using `ethpkg`.

In order to avoid execution of untrusted code on your machine you should familiarize with the Ethereum address concept. In the future, white-listing of authors will be required before execution is possible.
It is also an advantage to have a basic understanding of asymmetric cryptography and public and private keys - though you can absolutely use Grid without knowing these concepts in advance.

To make things easier, ENS support is available so that `0x39830fed4b4b17fcdfa0830f9ab9ed8a1d0c11d9/ethers-repl@1.0.0` becomes a more readable name like `grid.philipplgh.eth/ethers-repl`. 

## Writing your own workflow

Best thing to do is to first create a workspace to host our workflows:
```
mkdir grid-workflows
cd grid-workflows
```
Inside the workspace run:
```bash
Creating Grid config at: "Projects/grid-workflows/.grid.config.js" ...
✔ Path to keystore (default: "Projects/grid-workflows"): · 
✔ Path to cache (default: ".../Library/Application Support/Grid/cache"): · 
✔ License for workflows (default: "MIT"): · 
✔ Author name (default: ""): · PhilippLgh
✔ Author email (default: ""): · philipp@ethereum.org
✔ Trusted authors (default: []): · grid.philipp.eth
Success! Configuration created at ....
```

Verify that the config file was created and looks good:
```bash
cat .grid.config.js 
```

Now, it's time to create a workflow from a template:
```bash
$ grid-workflows % grid-core workflow init
 
  _____      _     _         _____ _      _____ 
 / ____|    (_)   | |       / ____| |    |_   _|
| |  __ _ __ _  __| |______| |    | |      | |  
| | |_ | '__| |/ _' |______| |    | |      | |  
| |__| | |  | | (_| |      | |____| |____ _| |_ 
 \_____|_|  |_|\__,_|       \_____|______|_____|
                                                
Grid Version 1.0.3

Grid uses configuration: .../grid-workflows/.grid.config.js 

✔ What is the name for your workflow? · my-workflow
Creating new workflow: "my-workflow" ...
Success! Created "my-workflow" at .../grid-workflows/my-workflow
Inside that directory, you can run several commands:

        yarn start
                Executes the workflow 

        yarn release
                Publishes the workflow so that you can share it

We suggest that you begin by typing:

cd my-workflow
yarn start

Decentralize everything! 🚀      🌛
```

You should also see the output `"Grid uses configuration: .../grid-workflows/.grid.config.js"`. Use it to verify that your config is active.

Follow on-screen instructions:
```bash
cd my-workflow
yarn start
```
You should see an output similar to:
```bash
                                                
Grid Version 1.0.3

Grid uses configuration: ...grid-workflows/.grid.config.js 

Starting workflow:
===================================================
Name: my-workflow
Version: 1.0.0
Description: This is the auto-generated test workflow.
===================================================
Output:
              
INFO : >> hello workflow {}
✔ Found release for: geth - darwin/latest
{
  "name": "geth-darwin-amd64-1.9.12-unstable-556888c4",
  "version": "1.9.12",
  "displayVersion": "v1.9.12",
  "fileName": "geth-darwin-amd64-1.9.12-unstable-556888c4.tar.gz",
  "updated_ts": 1583171136000,
  "updated_at": "2020-03-02 17:45:36",
  "size": "12018500",
  "location": "https://gethstore.blob.core.windows.net/builds/geth-darwin-amd64-1.9.12-unstable-556888c4.tar.gz",
  "remote": false
}
✔ Starting client geth with flags: []
INFO : >> Received client version via RPC: Geth/v1.9.12-unstable-556888c4-20200302/darwin-amd64/go1.13.8
===================================================
```

Congratulations! You just created and run your first workflow that sets up a local Geth node.
Now, is a good time to checkout the code. Open the `index.js' in your favorite IDE:
```bash
caode . index.js
```

```javascript
const { default: Grid, FlagBuilder, WorkflowUtils } = require('grid-core')
const ethers = require('ethers')
const { createLogger, prompt } = WorkflowUtils

// create a logger for your workflow
const logger = createLogger()
// and a new Grid instance
const grid = new Grid({
  logger
})

// entry point of your workflow
const run = async (config) => {
  logger.log('>> hello workflow', config)
  // this will download and extract the latest binaries
  const client = await grid.getClient('geth')
  // the FlagBuilder tool is used to generate flags from
  // multiple sources: e.g. user input, defaults, supported flags, profiles
  const flags = await FlagBuilder.create(client).default().toProcessFlags()
  // we pass the default flags to grid and start the binary
  // the call will return once the ipc connection is established
  // which is when geth is ready to receive commands
  const ipc = await grid.startClient(client, flags)

// we can use the rpc API to send rpc commands
  const clientVersion = await client.rpc('web3_clientVersion')
  logger.log('>> Received client version via RPC:', clientVersion)
  await grid.stopClient(client)
}

// lifecycle method:called before workflow stops
const onStop = async () => {
  // used to clean up
  // await grid.stopClients()
}

module.exports = {
  run,
  onStop
}
```

You can make modifications and re-run the code as you like.
Give your workflow a nice name and edit the metadata in the package.json.
Remove tags that are not fitting and make sure to change the default description.


Once you're done you can publish the workflow:
```bash
yarn release
```

```bash
 
  _____      _     _         _____ _      _____ 
 / ____|    (_)   | |       / ____| |    |_   _|
| |  __ _ __ _  __| |______| |    | |      | |  
| | |_ | '__| |/ _' |______| |    | |      | |  
| |__| | |  | | (_| |      | |____| |____ _| |_ 
 \_____|_|  |_|\__,_|       \_____|______|_____|
                                                
Grid Version 1.0.3

Info: Publish workflow: "."
Grid uses configuration: .../grid-workflows/.grid.config.js 

✔ Enter password to de/encrypt key · ****
✔ Unlocked signing key 0x988194Bc7dad7882Acb9A3BB5D27c484Ad863Fb5
✔ Created workflow package hello-grid-1.0.0.tar.gz
✔ Workflow package signed
✔ Uploading workflow "hello-grid" to: ethpkg
✔ Authentication finished. Logged in? true
✔ Uploaded workflow "hello-grid": 100%
done:
{
  name: 'hello-grid',
  displayName: 'hello-grid',
  version: '1.0.0',
  description: 'This is a test',
  shortDescription: 'This is a test',
  publisher: {
    name: 'PhilippLgh',
    displayName: 'PhilippLgh',
    address: '0x988194bc7dad7882acb9a3bb5d27c484ad863fb5'
  },
  assets: [
    {
      fileName: 'hello-grid-1.0.0.tar.gz',
      size: 1386,
      location: '0x59054E7c69D42FCcA9CC2f7Fd0BE52db00152669/workflows/0x988194bc7dad7882acb9a3bb5d27c484ad863fb5/public/hello-grid-1.0.0.tar.gz'
    }
  ],
  projectId: 'hello-grid',
  userId: '0x988194bc7dad7882acb9a3bb5d27c484ad863fb5',
  releaseId: '0x988194bc7dad7882acb9a3bb5d27c484ad863fb5/hello-grid@1.0.0',
  releaseUId: 'ff8249f8-17f7-4fa5-91ad-620b265ab690',
  created_at: 1583240054349,
  updated_at: 1583240054349
}


=======================================================================================
✨Congratulations!✨
You can find your published workflow here:
Run the workflow with:
=======================================================================================


grid-core workflow run 0x988194bc7dad7882acb9a3bb5d27c484ad863fb5/hello-grid@1.0.0


=======================================================================================
```

If you want to be informed about updates and releases please follow 
https://twitter.com/philipplgh
https://twitter.com/ethereumgrid