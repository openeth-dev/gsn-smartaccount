/* eslint-disable no-unused-expressions */
/* global before it */

import assert from 'assert'

export function testGetWalletInfoBehavior (getContext) {
  let wallet
  let initEvent
  const participantAddedEvents = []

  function getExpected (source) {
    const expected = require(source)
    expected.address = wallet.contract.address
    return expected
  }

  before(async function () {
    // Again, I do not like stubbing methods of class under test.
    // This should be moved to the interactor once we are refactoring as originally intended
    wallet = getContext().wallet
    initEvent = require('../testdata/GetWalletInfoSampleEvents/InitialConfigEvent')
    initEvent.address = wallet.contract.address
    wallet._getCompletedConfigurationEvents = function () {
      return { participantAddedEvents, initEvent }
    }
    wallet._getAllowedFlags = function () {
      return { allowAcceleratedCalls: true }
    }
  })

  it('should recognize vault state after initial configuration', async function () {
    const expectedWalletInfo = getExpected('../testdata/ExpectedWalletInfoA')
    const walletInfo = await wallet.getWalletInfo()
    assert.deepStrictEqual(walletInfo, expectedWalletInfo)
  })

  it('should recognize vault configuration after participant added', async function () {
    const participantAddedEvent = require('../testdata/GetWalletInfoSampleEvents/ParticipantAddedEvent')
    participantAddedEvents.push(participantAddedEvent)
    const expectedWalletInfo = getExpected('../testdata/ExpectedWalletInfoB')
    const walletInfo = await wallet.getWalletInfo()
    assert.deepStrictEqual(walletInfo, expectedWalletInfo)
  })

  it('should recognize vault configuration if some participants are not recognized')
}
