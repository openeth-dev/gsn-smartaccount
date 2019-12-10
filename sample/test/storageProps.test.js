import {assert} from 'chai'
import { storageProps } from '../src/js/impl/Account.impl'
class Storage {
 constructor () {
   this.data={}
 }

  setItem (p, val) { this.data[p] = val}

  getItem (p) { return this.data[p]}
}

describe('storageProps', () => {
  const store = new Storage()
  const props = storageProps(store)

  it( "read prop", ()=>{
    assert.equal(props.a, null)
    assert.equal(store.getItem('a'), null)
    store.setItem("a", 1)
    assert.equal( store.getItem("a"), 1)
    assert.equal(props.a, 1)
  })
  it( "set prop", ()=>{
    assert.equal(props.b, null)
    assert.equal(store.getItem('b'), null)
    props.b=123
    assert.equal( store.getItem("b"), 123)
    assert.equal(props.b, 123)
  })
})