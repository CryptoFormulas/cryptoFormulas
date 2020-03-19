/////////////////// Dependencies ///////////////////////////////////////////////
let {solBuild,  solConcatBuild, solWatch} = require('soliditySapper')
const fs = require('fs')


/////////////////// Settings ///////////////////////////////////////////////////

// index format: "sourceRootDirectory indexFile outputDirectory"
const solIndeces = [
    'src/contracts src/contracts/CryptoFormulas.sol dist/src/contracts',
    'src/contracts src/contracts/StaticUpdate.sol dist/src/contracts',
    'src/contracts src/contracts/FormulaValidator.sol dist/src/contracts',

    'tests/contracts tests/contracts/TestingTokens.sol dist/tests/contracts',
    'tests/contracts tests/contracts/FormulasDebugger.sol dist/tests/contracts',
    'tests/contracts tests/contracts/FormulasFeeless.sol dist/tests/contracts',
]

/////////////////// Logic //////////////////////////////////////////////////////
const solFromDist = item => item.split(' ')
    .filter((dummy, index) => index > 0) // no need for root directory now
    .map((item, index) => index > 0 ? item : 'dist/' + item) // add prefix `dist/` before source file path

let commands
commands = {
    // main commands
    build: async () => true
        && await Promise.all(commands.concatContracts())
        && await Promise.all(commands.buildContracts()),

    watch: () => commands.watchContracts(),

    // build subcommands
    concatContracts: () => solIndeces
        .map(item => solConcatBuild(
            ...item.split(' ').filter((dummy, index) => index > 0)
        )),
    buildContracts: () => solIndeces
        .map(solFromDist)
        .map(item => solBuild(...item)),

    // watch subcommands
    watchContracts: async () => solIndeces.map((item) => {
        const itemParams = item.split(' ')

        // concat all files on each refresh
        const refreshCallback = async () => await solConcatBuild(...itemParams.filter((dummy, index) => index > 0))
        solWatch(...itemParams, refreshCallback)
    })
}


/////////////////// Utils //////////////////////////////////////////////////////

function ensureFolder(folder) {
    try {
        fs.mkdirSync(folder)
    } catch (e) {
        if (!e || (e && e.code !== 'EEXIST')) {
            // directory already exists
            throw e
        }
    }
}


/////////////////// Run Command ////////////////////////////////////////////////
if (process.argv.length != 3 || !commands[process.argv[2]]) {
    console.log('invalid arguments')
    process.exit(1)
}

[
    './dist',
    './dist/src',
    './dist/src/contracts',
    './dist/tests',
    './dist/tests/contracts'
].map(ensureFolder)
commands[process.argv[2]]()
