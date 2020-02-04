import TestEnvironment from '../test/utils/TestEnvironment'
import parseArgs from 'minimist'

const argv = parseArgs(process.argv.slice(2))

const useTwilio = (argv.S || argv.sms) === 'twilio'
const useDev = argv.dev || argv.D
const relayUrl = argv.R
console.log('start backend for real GSN')
TestEnvironment.initializeAndStartBackendForRealGSN({ useTwilio, useDev, relayUrl })
console.log('backend started. click Ctrl-C to abort..')
