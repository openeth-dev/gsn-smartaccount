/* global error */

import SimpleWalletApi from '../api/SimpleWallet.api'

export default class SimpleWalletMock extends SimpleWalletApi {
  constructor ({ email, address }) {
    super()
    this.email = email
    this.address = address
  }

  async initialConfiguration (configuration) {
    error('set initial configuration in the contract')
  }

  transfer ({ destination, amount, token }) {
    error('initiate transfer operation. adds a pending item, depending on transfer policy')
  }

  removeOperator (addr) {
    error('add "remove operator" operation, (delayed, can be canceled by watchdog)')
  }

  cancelPending (id) {
    error('immediately cancel a pending operation (see listPending)')
  }

  refresh () {
    error('refresh state from blockchain: all the ilstXXX operations')
  }

  // whitelist operations
  // TODO: maybe move them to inner "policy-specific" object ?

  transferWhiteList ({ destAddr, amount, token }) {
    error('perform a transfer to a whitelisted address')
  }

  addWhitelist (addrs) {
    error('add pending operation to add entries to whitelist')
  }

  removeWhitelist (addrs) {
    error('remove entries from whitelist (immediate)')
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
    return ['add1', 'add2']
  }

  async getWalletInfo () {
    let addr
    return {
      address: this.address,
      options: {
        allowAddOperatorNow: false,
        allowAcceleratedCalls: false
      },
      operators: [addr, addr],
      guardians: [
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

  listTokens () {
    return [
      { token: 'ETH', balance: 10e18, decimals: 18 },
      { token: 'DAI', balance: 10e18, decimals: 18 },
      { token: 'BAT', balance: 10e18, decimals: 18 }
    ]
  }

  async listPending () {
    return {
      operations: [
        { type: 'transfer', value: 100, token: 'ETH' },
        {
          id: 0x222,
          state: 'mining',
          dueTime: '',
          canCancel: true,
          operations: [
            { type: 'addDevice' }
          ]
        },
        {
          id: 0x333,
          state: 'mined',
          dueTime: '<>',
          operations: [
            { type: 'addWhiteList', params: ['0x1234'] },
            { type: 'addWhiteList', params: ['0x5678'] }
          ]
        }
      ]
    }
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
}
