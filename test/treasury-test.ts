import { expect } from "chai";
import { Contract, WalletTypes, zeroAddress, Address } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { FactorySource } from "../build/factorySource";
import * as nt from "nekoton-wasm";


let Treasury: Contract<FactorySource["Treasury"]>;
let ownerTokenWallet: Contract<FactorySource["TokenWallet"]>;
let TokenRoot: Contract<FactorySource["TokenRoot"]>;
let owner: Account;
let ownerKeys: nt.Ed25519KeyPair;

describe("Test Tresury contract", async function () {
  before(async () => {
    ownerKeys = nt.ed25519_generateKeyPair();
    locklift.keystore.addKeyPair(ownerKeys);
    const TokenRootSampleData = locklift.factory.getContractArtifacts("TokenRoot");
    const { account } = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3,
      publicKey: ownerKeys.publicKey,
      value: locklift.utils.toNano(2),
    });
    owner = account;

    const TokenWalletContract = locklift.factory.getContractArtifacts("TokenWallet");

    const { contract } = await locklift.factory.deployContract({
      contract: "TokenRoot",
      publicKey: ownerKeys.publicKey,
      initParams: {
        name_: "Test Token",
        symbol_: "TST",
        decimals_: 18,
        rootOwner_: owner.address,
        walletCode_: TokenWalletContract.code,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: zeroAddress,
      },
      constructorParams: {
        initialSupplyTo: owner.address,
        initialSupply: 1000000,
        deployWalletValue: locklift.utils.toNano(0.1),
        mintDisabled: true,
        burnByRootDisabled: true,
        burnPaused: true,
        remainingGasTo: owner.address,
      },
      value: locklift.utils.toNano(2),
    });

    TokenRoot = contract;
    const { value0: balance } = await TokenRoot.methods.totalSupply({ answerId: 0 }).call();

    expect(Number(balance)).equal(1000000, "Contract total supply should be the same as initial supply");
  });
  describe("Contracts", async function () {
    it("Load contract factory", async function () {
      const trasuryFactory = await locklift.factory.getContractArtifacts("Treasury");
      expect(trasuryFactory.code).not.to.equal(undefined, "Code should be available");
      expect(trasuryFactory.abi).not.to.equal(undefined, "ABI should be available");
      expect(trasuryFactory.tvc).not.to.equal(undefined, "tvc should be available");
    });


    it("Deploy contract", async function () {
      const INIT_STATE = 0;
      const { contract, tx } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "Treasury",
        publicKey: ownerKeys.publicKey,
        initParams: {
          nonce_: locklift.utils.getRandomNonce(),
          deployer_: zeroAddress,
        },
        constructorParams: {
          _owner: owner.address
        },
        value: locklift.utils.toNano(20),
      }));
      Treasury = contract;

      expect(await locklift.provider.getBalance(Treasury.address).then(balance => Number(balance))).to.be.above(0);
    });

    it("owner is the signer", async function () {
      const response = await Treasury.methods.owner().call();
      expect(response.value0.toString()).to.be.equal(owner.address.toString(), "Wrong state");
    });    
  });
});
