/* global describe it */
import { assert, expect } from 'chai'
import { storageProps } from '../src/js/impl/Account'
import { MockStorage } from './mocks/MockStorage'

describe('storageProps', () => {
  const store = new MockStorage()
  const props = storageProps(store)

  it('read prop', () => {
    assert.equal(props.a, null)
    assert.equal(store.getItem('a'), null)
    store.setItem('a', 1)
    assert.equal(store.getItem('a'), 1)
    assert.equal(props.a, 1)
  })
  it('should fail to set with non-string (numeric)', () => {
    expect(() => { props.asd = 1 }).to.throw('Invalid storage value')
  })
  it('should fail to set with non-string (object)', () => {
    expect(() => { props.asd = {} }).to.throw('Invalid storage value')
  })
  it('set prop', () => {
    assert.equal(props.b, null)
    assert.equal(store.getItem('b'), null)
    props.b = '123'
    assert.equal(store.getItem('b'), 123)
    assert.equal(props.b, 123)
  })
  it('set to undefined should remove', () => {
    props.b = '123'
    assert.equal(props.b, '123')
    props.b = undefined
    assert.equal(props.b, null)
  })
})
