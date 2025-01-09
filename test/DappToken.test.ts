import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3, network } from 'hardhat';
import deployDappTokenFixture from './fixtures/FixtureDappToken';

describe('DappToken', function () {
    let dappToken: any;

    this.beforeAll(async function(){
        const {	DappToken } = await loadFixture(deployDappTokenFixture)
        dappToken = DappToken;
    })
	it("test Deploy events DappToken", async function(){
		const EventsDapp = await dappToken.getPastEvents("Deployed",{
            filter: {
                //src: [Proxy.options.address] // se puede filtrar por propiedad "src" address o "dst" address
            }, 
            fromBlock: 1n,
            toBlock: "latest",
        })
		const addrDapp = EventsDapp[0].returnValues.addr
		expect(addrDapp).to.be.equal(dappToken.options.address)
	})
    it("solo el owner puede mintear",async function(){
        const [owner, otherAccount] = await web3.eth.getAccounts()
        try {
            await dappToken.methods.mint(otherAccount, "1000").send({from: otherAccount}) 
        } catch (e) {
            expect(e).to.be.revertedWith("")
        }
        const amountMinted = await dappToken.methods.mint(otherAccount, "1000").send({from: owner})
        expect(amountMinted).to.be.ok
    })
})