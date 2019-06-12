var DelayedOperations = artifacts.require("./DelayedOperations.sol");

contract('DelayedOperations', function (accounts) {

    /* Positive flows */

    it("should emit event and save hash when new delayed operation is added");

    it("should be able to differentiate between two identical delayed operations");


    /* Negative flows */


    it("should not allow to create delayed operations without a delay");

    it("should not allow to execute a transaction before it's delay is expired");

    it("should not allow to execute the same transaction twice");

    it("should not allow to cancel an already executed transaction");
});