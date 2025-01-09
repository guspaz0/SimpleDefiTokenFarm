import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3, network } from 'hardhat';
import deployLpTokenFixture from './fixtures/FixtureLpToken';

describe('DappToken', function () {
    let lpToken: any;

    this.beforeAll(async function(){
        const {	LpToken } = await loadFixture(deployLpTokenFixture)
        lpToken = LpToken;
    })
    it("test Deploy events LpToken", async function(){
        const EventsDapp = await lpToken.getPastEvents("Deployed",{
            filter: {
                //src: [Proxy.options.address] // se puede filtrar por propiedad "src" address o "dst" address
            }, 
            fromBlock: 1n,
            toBlock: "latest",
        })
        const addrDapp = EventsDapp[0].returnValues.addr
        expect(addrDapp).to.be.equal(lpToken.options.address)
    })
    it("solo el owner puede mintear",async function(){
        const [owner, otherAccount] = await web3.eth.getAccounts()
        try {
            await lpToken.methods.mint(otherAccount, 1000).send({from: otherAccount}) 
        } catch (e) {
            expect(e).to.be.revertedWith("")
        }
        const amountMinted = await lpToken.methods.mint(otherAccount, 1000).send({from: owner})
        expect(amountMinted).to.be.ok
    })
})