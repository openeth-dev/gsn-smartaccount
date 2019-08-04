#!/usr/bin/env node

const solc = require('solc');
const fs = require('fs');

// TODO: pass all these things as parameters
const projectFolder = "solidity/";
const contractsFolder = projectFolder + "contracts";
const outAbiFolder = "js_foundation/src/js/generated";

const contractsToExtract = ["Gatekeeper", "Vault", "VaultFactory", "Utilities"];

function compileFile(contractFile, c) {
    let contractSource = fs.readFileSync(contractFile, {encoding: 'utf8'});

    let input = {
        language: 'Solidity',
        sources: {
            contractFile: {
                content: contractSource
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    };
    let result;
    let abi;
    let binary;
    try {
        let compile = solc.compile(JSON.stringify(input), function (path) {
            let realPath = contractsFolder + "/" + path;
            if (!fs.existsSync(realPath)) {
                realPath = projectFolder + "node_modules/" + path;
            }
            console.log(fs.existsSync(realPath) ? "resolved:" : "failed to resolve", realPath);

            return {
                'contents': fs.readFileSync(realPath).toString()
            }
        });
        result = JSON.parse(compile);
        abi = JSON.stringify(result.contracts.contractFile[c].abi);
        binary = result.contracts.contractFile[c].evm.bytecode.object;
    } catch (e) {
        console.log(e)
    }
    if (!abi) {
        console.log("ERROR: failed to extract abi:", result);
        process.exit(1)
    }

    return {abi, binary};
}

contractsToExtract.forEach(c => {

    let contractFile = contractsFolder + "/" + c + ".sol";
    let outAbiFile = outAbiFolder + "/" + c + ".js";
    let outBinFile = outAbiFolder + "/" + c + ".bin";
    //TODO: Cannot depend on timestamps when working with interdependent contracts
    /*
    try {
        if (fs.existsSync(outAbiFile) &&
            fs.statSync(contractFile).mtime <= fs.statSync(outAbiFile).mtime) {
            console.log("not modified: ", contractFile);
            return;
        }
    } catch (e) {
        console.log(e);
    }
    */
    let {abi, binary} = compileFile(contractFile, c);

    fs.writeFileSync(outAbiFile, "module.exports=" + abi);
    fs.writeFileSync(outBinFile, binary);
    console.log("written \"" + outAbiFile + "\"")
    console.log("written \"" + outBinFile + "\"")
});

