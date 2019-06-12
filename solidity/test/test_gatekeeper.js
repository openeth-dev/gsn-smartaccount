var Gatekeeper = artifacts.require("./Gatekeeper.sol");

contract('Gatekeeper', function (accounts) {

    /* Positive flows */

    /* Plain send */
    it("should allow the owner to create a delayed transaction");

    /* Canceled send */
    it("should allow the owner to cancel a delayed transaction");

    /* Rejected send */
    it("should allow the admin to cancel a delayed transaction");

    /* Admin replaced */
    it("should allow the admin to replace another admin after a delay");

    /* Owner loses phone*/
    it("should allow the admin to replace the owner after a delay");

    /* Owner finds the phone after losing it */
    it("should allow the owner to cancel an owner change");

    /* Owner finds the phone after losing it */
    it("should allow the admin to cancel an owner change");

    /* doomsday recover: all participants malicious */
    it("should allow the super-admin to lock out all participants, cancel all operations and replace all participants");

    /* Negative flows */

    /* Owner’s phone controlled by a malicious operator */
    it("should not allow the owner to cancel an owner change if an admin locks him out");

    /* Plain send - opposite */
    it("should not allow non-owner to create a delayed transaction");

    /* Admin replaced - opposite  & Owner loses phone - opposite */
    it("should not allow non-admin to replace admins or owners");




});