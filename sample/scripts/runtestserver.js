import TestEnvironment from '../test/utils/TestEnvironment'
import parseArgs from 'minimist'

const argv = parseArgs(process.argv.slice(2))

const useTwilio = (argv.S || argv.sms) === 'twilio'
const useDev = argv.dev || argv.D
const relayUrl = argv.R
const urlPrefix = argv.urlPrefix || argv.U
console.log('start backend for real GSN')
TestEnvironment.initializeAndStartBackendForRealGSN({ useTwilio, useDev, relayUrl, urlPrefix })
console.log('backend started. click Ctrl-C to abort..')
