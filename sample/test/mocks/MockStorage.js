export class MockStorage {
  constructor () {
    this.data = {}
  }

  removeItem (p) {
    delete this.data[p]
  }

  setItem (p, val) {
    this.data[p] = val
  }

  getItem (p) {
    return this.data[p]
  }
}
