/* global describe before after it */

// import { Account, Backend } from '../../src/js/backend/Backend'
// import { assert } from 'chai'
import Web3 from 'web3'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { Watchdog } from '../../src/js/backend/Guardian'
import { sleep } from './testutils'

describe.skip('As Guardian', async function () {
  let watchdog
  let smsProvider
  let backend // TODO replace with accountManager, keyManager
  let contract
  const ethNodeUrl = 'http://localhost:8545'
  let web3provider

  describe('As Watchdog', async function () {
    before(async function () {
      web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
    })

    it('should start Watchdog', async function () {
      this.timeout(1000 * 30)
      smsProvider = new SMSmock()
      watchdog = new Watchdog({ smsProvider, backend, contract, web3provider })

      console.log('web3 is ', Web3)
      watchdog.start()
      await sleep(5 * 1000)
      console.log('fuck')
    })

    after(async function () {
      await watchdog.stop()
    })
  })

  describe('As Admin', async function () {
  })
})
