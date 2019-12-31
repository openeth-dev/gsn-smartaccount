export default {
  getSmartAccountId: async function () {
    return '0x' + '1'.repeat(64)
  },
  createAccount: async function () {
    return {
      approvalData: '0x' + 'f'.repeat(64),
      smartAccountId: '0x' + '1'.repeat(64)
    }
  },
  getAddresses: async function () {
    return {
      watchdog: '0x' + '1'.repeat(40)
    }
  }
}