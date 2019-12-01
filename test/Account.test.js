const {assert, expect} = require('chai')
const {AccountMock} = require('./mocks/Account.mock')

context('test account mock', () => {
    let acct
    beforeEach("test account", () => {

        localStorage = {}
        acct = new AccountMock()
    })

    it("getEmail", () => {

        assert.equal(acct.getEmail(), null)
        acct.googleLogin()
        assert.equal(acct.getEmail(), "user@email.com")
    })

    it("createOwner should fail before login", async () => {
        expect(acct.createOwner).to.throw("not logged in")
    })

    it("getOwner after createOwner should return address", async () => {
        assert.equal(acct.getOwner(), null)
        acct.googleLogin()
        acct.createOwner()
        assert.equal(acct.getOwner(), "addr")
    })

    it("createOwner should fail if called twice", async () => {
        acct.googleLogin()
        acct.createOwner()
        expect(acct.createOwner).to.throw("owner already created")
    })
})
