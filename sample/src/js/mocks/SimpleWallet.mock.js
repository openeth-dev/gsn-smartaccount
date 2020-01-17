/* global error */

import SimpleWalletApi from '../api/SimpleWallet.api'
import DelayedTransfer from '../etc/DelayedTransfer'
import DelayedContractCall from '../etc/DelayedContractCall'
import DelayedConfigChange from '../etc/DelayedConfigChange'
import ConfigEntry from '../etc/ConfigEntry'
import { EventEmitter } from 'events'

export default class SimpleWalletMock extends SimpleWalletApi {
  constructor ({ email, address }) {
    super()
    this.email = email
    this.address = address
    this.whitelist = []
    this.events = new EventEmitter()
  }

  async initialConfiguration (configuration) {
    this.whitelist = configuration.whitelist
  }

  async transfer ({ destination, amount, token }) {
    error('initiate transfer operation. adds a pending item, depending on transfer policy')
  }

  async removeParticipant ({ address, permissions, level }) {
    error('add "remove operator" operation, (delayed, can be canceled by watchdog)')
  }

  async cancelPending (delayedOpId) {
    error('immediately cancel a pending operation (see listPending)')
  }

  refresh () {
    error('refresh state from blockchain: all the ilstXXX operations')
  }

  // whitelist operations
  // TODO: maybe move them to inner "policy-specific" object ?

  transferWhiteList ({ destination, amount, token }) {
    error('perform a transfer to a whitelisted address')
  }

  async setWhitelistedDestination (destination, isWhitelisted) {
    if (isWhitelisted) {
      this.whitelist = [...this.whitelist, ...destination]
      this.events.emit('events')
    } else {
      this.whitelist = this.whitelist.filter(it => destination.indexOf(it) < 0)
      this.events.emit('events')
    }
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
    return this.whitelist
  }

  async isOperator (address) {
    return true
  }

  async isOperatorOrPending (address) {
    return true
  }

  async subscribe (observer) {
    this.events.on('events', observer)
  }

  async unsubscribe (observer) {
    this.events.off('events', observer)
  }

  async getWalletInfo () {
    let addr
    return {
      address: this.address,
      options: {
        allowAddOperatorNow: false,
        allowAcceleratedCalls: false
      },
      participants: [
        { addr: addr, level: 1, type: 'operator' },
        { addr: 0x123, level: 1, type: 'watchdog' },
        { addr: 0x123, level: 1, type: 'admin' }
      ],
      unknownGuardians: 0,
      levels: [
        {
          delay: '1234',
          requiredApprovals: 2
        },
        {
          delay: '2345',
          requiredApprovals: 0
        }
      ]
    }
  }

  async listTokens () {
    return [
      { symbol: 'ETH', balance: 10e18, decimals: 18 },
      { symbol: 'DAI', balance: 10e18, decimals: 18 },
      { symbol: 'BAT', balance: 10e18, decimals: 18 }
    ]
  }

  /**
   * Note: does not include contract calls that are identified as changes to Bypass Policy configuration
   */
  async listPendingTransactions () {
    return [
      new DelayedTransfer({
        txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
        delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
        state: 'mining',
        operation: 'transfer',
        tokenSymbol: 'ETH',
        value: 100,
        destination: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
      }),
      // Unknown payable function call
      new DelayedContractCall(
        {
          txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
          delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
          state: 'mined',
          value: 100,
          destination: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
          data: '0x10203040'
        }),
      // ERC20 calls
      new DelayedTransfer({
        txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
        delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
        dueTime: 123123123123,
        state: 'mined',
        operation: 'transfer',
        tokenSymbol: 'DAI',
        value: 100,
        destination: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
      }),
      new DelayedTransfer({
        txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
        delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
        dueTime: 123123123123,
        state: 'mined',
        operation: 'approve',
        tokenSymbol: 'DAI',
        value: 100,
        destination: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
      })
    ]
  }

  /**
   * Note: includes contract calls that are identified as changes to Bypass Policy configuration
   */
  async listPendingConfigChanges () {
    return [
      new DelayedConfigChange({
        txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
        delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
        dueTime: 123123123123,
        state: 'mined',
        operations: [
          new ConfigEntry(
            {
              type: 'addWhiteList',
              args: ['0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1', '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'],
              targetModule: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
            })
        ]
      }),
      new DelayedConfigChange({
        txHash: '0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3',
        delayedOpId: '0x0004972fe1e499aab8729c12217895c8b7d8c090f62fbdd367aaa82173702e7d',
        dueTime: 123123123123,
        state: 'mined',
        operations: [
          new ConfigEntry(
            {
              type: 'add_operator',
              args: ['0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1']
            },
            {
              type: 'remove_participant',
              args: ['0xe30802e8d9e93134d02fa30e36f238ec027216197f91483935e89a47d4b7b8d3']
            }
          )
        ]
      })
    ]
  }

  listBypassPolicies () {
    return [
      {
        id: '0x12345',
        name: 'WhiteListed Addresses',
        description: ' Whitelisted address where transfer operations are immediate',
        targetMethods: [
          'transfer(uint,uint)',
          'approve(uint, uint)'
        ],
        adminActions: [
          {
            method: 'addWhiteList(address)',
            title: 'Add',
            params: [
              { type: 'address', description: 'address to whitelist' }
            ]
          },
          {
            method: 'removeWhiteList(address)',
            title: 'Remove',
            params: [
              {
                type: 'address',
                description: 'address to remove from whitelist',
                values: '$contract.listAddresses()'
              }
            ]
          }
        ]

      }
    ]
  }

  async addOperatorNow (newOperator) {
    error()
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    super.validateAddOperatorNow({ jwt, smsCode })
  }

  async applyAllPendingOperations () {
    super.applyAllPendingOperations()
  }

  async scheduleAddOperator ({ newOperator }) {
    super.scheduleAddOperator({ newOperator })
  }

  async deployWhitelistModule ({ whitelistPreconfigured }) {
    super.deployWhitelistModule({ whitelistPreconfigured })
  }

  async scheduleBypassCall ({ destination, value, encodedTransaction }) {
    super.scheduleBypassCall({ destination, value, encodedTransaction })
  }

  async getWhitelistModule () {
    super.getWhitelistModule()
  }
}
