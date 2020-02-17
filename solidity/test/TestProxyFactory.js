/* global describe before it assert artifacts */
const ProxyFactory = artifacts.require('ProxyFactory')
const SmartAccount = artifacts.require('SmartAccount')
const BypassLib = artifacts.require('BypassLib')

describe('#ProxyFactory', () => {
  let factory, template, bypassLib
  before(async () => {
    factory = await ProxyFactory.new()
    bypassLib = await BypassLib.new({ gas: 8e6 })
    template = await SmartAccount.new(bypassLib.address, { gas: 1e7 })
  })

  let acc

  it('create proxy', async () => {
    const ret = await factory.createProxy(template.address, '0x')
    const proxyAddress = ret.logs.find(e => e.event === 'ProxyDeployed').args.proxyAddress

    acc = await SmartAccount.at(proxyAddress)
  })

  it('modify proxy shouldn\'t change template', async () => {
    await acc.ctr2('0x' + '0'.repeat(40), '0x' + '3'.repeat(40), '0x' + '3'.repeat(40))
    assert.equal(await acc.creator(), '0x' + '3'.repeat(40))
    assert.equal(await template.creator(), '0x' + '0'.repeat(40))
  })
})
