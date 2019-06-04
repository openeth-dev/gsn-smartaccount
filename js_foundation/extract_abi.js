#!/usr/bin/env node

const solc = require('solc')
const fs = require('fs')

contractsFolder ="contracts"
outAbiFolder = "src/js/generated"

contractsToExtract =[ "Contract" ]

contractsToExtract.forEach( c => {

	contractFile = contractsFolder + "/"+ c + ".sol"
	outAbiFile = outAbiFolder + "/" + c +".js"

	try {
		if ( fs.statSync(contractFile).mtime <= fs.statSync(outAbiFile).mtime ) {
			console.log( "not modified: ", outAbiFile )
			return
		}
	} catch(e){
		//target file is missing.
	}

	hubApi = fs.readFileSync( contractFile, {encoding:'utf8'} )

	let input = {
		language: 'Solidity',
		sources: {
			contractFile: {
				content: hubApi
			}
		},
		settings: {
			outputSelection: {
				'*': {
					'*': [ '*' ]
				}
			}
		}
	}
	result = JSON.parse(solc.compile(JSON.stringify(input)))

	if ( result.errors ) {
		console.log( "ERROR: ", result )
		process.exit(1)
	}

	abi = JSON.stringify(result.contracts.contractFile[ c ].abi)

	if ( !abi )  {
		console.log( "ERROR: failed to extract abi:", result)
		process.exit(1);
	} else {

		fs.writeFileSync( outAbiFile, "module.exports="+abi )
		console.log( "written \""+outAbiFile+"\"" )
	}
})

