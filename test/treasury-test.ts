import { expect } from "chai";
import { Contract, WalletTypes, zeroAddress, Address } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { FactorySource } from "../build/factorySource";
import * as nt from "nekoton-wasm";


let Treasury: Contract<FactorySource["Treasury"]>;
let OwnerTokenWallet: Contract<FactorySource["TokenWallet"]>;
let TreasuryTokenWallet: Contract<FactorySource["TokenWallet"]>;
let Person2TokenWallet: Contract<FactorySource["TokenWallet"]>;
let TokenRoot: Contract<FactorySource["TokenRoot"]>;
let owner: Account;
let person2: Account;
let ownerKeys: nt.Ed25519KeyPair;
let person2Keys: nt.Ed25519KeyPair;

describe("Test Tresury contract", async function () {
  before(async () => {
    ownerKeys = nt.ed25519_generateKeyPair();
    person2Keys = nt.ed25519_generateKeyPair();

    locklift.keystore.addKeyPair(ownerKeys);
    locklift.keystore.addKeyPair(person2Keys);
    const TokenRootSampleData = locklift.factory.getContractArtifacts("TokenRoot");
    const { account } = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3,
      publicKey: ownerKeys.publicKey,
      value: locklift.utils.toNano(2),
    });
    owner = account;    
    const { account: account2 } = await locklift.factory.accounts.addNewAccount({
      type: WalletTypes.WalletV3,
      publicKey: person2Keys.publicKey,
      value: locklift.utils.toNano(2),
    });
    person2 = account2;
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
    it("accept tokens on Treasury", async function (){
      const response = await TokenRoot.methods
        .walletOf({
          answerId:0,
          walletOwner: owner.address
        }).call({});
      OwnerTokenWallet = await locklift.factory.getDeployedContract("TokenWallet", response.value0);
      await OwnerTokenWallet.methods.transfer({
          amount:"1000", 
          recipient: Treasury.address,
          deployWalletValue:locklift.utils.toNano(1),
          remainingGasTo:owner.address,
          notify: false,
          payload:""
        }).send({
          from:owner.address,
          amount:locklift.utils.toNano(2)
        });
      await locklift.tracing.trace(OwnerTokenWallet.methods.transfer({
          amount:"1000", 
          recipient: Treasury.address,
          deployWalletValue:locklift.utils.toNano(0.1),
          remainingGasTo:owner.address,
          notify: false,
          payload:""
        }).send({
          from:owner.address,
          amount:locklift.utils.toNano(2)
        }));
      const {value0: treasuryTokenWalletAddr} = await TokenRoot.methods
          .walletOf({
            answerId:0,
            walletOwner: Treasury.address
          }).call({});
        TreasuryTokenWallet = await locklift.factory.getDeployedContract("TokenWallet", treasuryTokenWalletAddr);
        let {value0: ownerBalance} = await OwnerTokenWallet.methods.balance({answerId:"0"}).call();
        let {value0: treasuryBalance} = await TreasuryTokenWallet.methods.balance({answerId:"0"}).call();
        expect(ownerBalance).to.be.equal("999000");
        expect(treasuryBalance).to.be.equal("1000");
    });
    it("transfer tokens from treasury", async function () {
      console.log("person2 address:", person2.address);
      let {value0: ownerBalance} = await OwnerTokenWallet.methods.balance({answerId:"0"}).call();
      console.log("owner balance:", ownerBalance);
      
        let {value0: ownerBalance2} = await OwnerTokenWallet.methods.balance({answerId:"0"}).call();
        console.log("owner balance:", ownerBalance2);
      // await Treasury.methods
      //   .transfer({
      //       _tokenRoot: TokenRoot.address,
      //       _amount: "20",
      //       _recipient: person2.address,
      //     })
      //     .send({
      //       from: owner.address,
      //       amount: locklift.utils.toNano(2),
      //   });
      const {value0: person2walletAddr} = await TokenRoot.methods
        .walletOf({
          answerId:0,
          walletOwner: person2.address
        }).call({});
      Person2TokenWallet = await locklift.factory.getDeployedContract("TokenWallet", person2walletAddr);
      console.log("Person 2 token wallet address: ", Person2TokenWallet.address);
      let {value0: person2TokenBalance} = await Person2TokenWallet.methods.balance({answerId:"0"}).call();
      expect(person2TokenBalance.toString).to.be.equal("1000", "Wrong state");
    });
  });
});
