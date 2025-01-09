import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3, network } from 'hardhat';
import deployTokenFarmV1Fixture from './fixtures/FixtureTokenFarmV1'


describe('TokenFarmV1', function () {

	let RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e15}
	let dappToken: any;
	let lpToken: any;
	let tokenFarm: any;
	let proxy: any;
	let userTransactions: Array<{address: string, block: string, amount: string, rewards: any}> = []

	this.beforeAll(async function(){
		const {	TokenFarm, deployer, DappToken, LpToken, Proxy} = await loadFixture(deployTokenFarmV1Fixture)
		dappToken = DappToken;
		lpToken = LpToken;
		tokenFarm = TokenFarm;
		proxy = Proxy;
	})


	it("TokenFarm version must be V1", async function(){
		const [owner] = await web3.eth.getAccounts();
		const version = await proxy.methods.version().call({from: owner})
		expect(version).to.be.equal("1.0.0")
	})

	it("If some user attempts to get User Info from an address that is not staking, should receive a error message", async function(){
		const [owner, otherAccount ] = await web3.eth.getAccounts();
		try {
			await proxy.methods.getUserInfo(otherAccount).call({from: otherAccount})
		} catch (e) {
			expect(e.cause.errorArgs.message).to.be.revertedWith("solo usuarios con stacking pueden operar")
		}
	})

	it("An error must be thrown if some user attempts to call withdraw function and his balance is 0", async function(){
		const [owner, otherAccount] = await web3.eth.getAccounts();
		try {
			await proxy.methods.withdraw().send({from: otherAccount})
		} catch (e) {
			expect(e.customErrorArguments.message).to.be.revertedWith("el balance del Stack del usuario no es mayor a cero")
		}
	})

	it('The owner of DappToken must be TokenFarm', async function () {
		const [deployer, otherAccount] = await web3.eth.getAccounts();
		await dappToken.methods.transferOwnership(proxy.options.address).send({from: deployer})
		const ownerDappToken = await dappToken.methods.owner().call();
		expect(ownerDappToken).to.equal(proxy.options.address);
	});

	describe('Acuñar (mint) tokens LP para un usuario y realizar un depósito de esos tokens.', function () {
		const amountMinted = '1000'
		it('Current Balance of OtherAccount must be equal than initial balance plus amount after Mint of LpToken', async function () {
			const [deployer, otherAccount] = await web3.eth.getAccounts();
			const owner = await lpToken.methods.owner().call();
			const initialBalance = await lpToken.methods.balanceOf(otherAccount).call({from: owner})
			await lpToken.methods.mint(otherAccount,amountMinted).send({from: owner})
			const currentBalance = await lpToken.methods.balanceOf(otherAccount).call({from: owner})
			expect(currentBalance).to.equal(initialBalance+amountMinted);
		});

		it('After approve minted LpToken amount of OtherAccount to spender TokenFarm, new allowance must be equal than initial allowance plus minted amount', async function () {
			const [deployer, otherAccount] = await web3.eth.getAccounts();
			const initialAllowance = await lpToken.methods.allowance(otherAccount, proxy.options.address).call({from: otherAccount});
			await lpToken.methods.approve(proxy.options.address, amountMinted).send({from: otherAccount})
			const currentAllowance = await lpToken.methods.allowance(otherAccount, proxy.options.address).call({from: otherAccount});
			expect(currentAllowance).to.equal(initialAllowance+amountMinted);
		});

		it("If the amount of deposit is less or equal than 0, the function is reverted", async function(){
			const [deployer, otherAccount] = await web3.eth.getAccounts();
			try {
				await proxy.methods.deposit("0").send({from: otherAccount})
			} catch (e) {
				expect(e.customErrorArguments.message).to.be.revertedWith("La cantidad no puede ser menor a 0")
			}
		}) 

		it('After deposit LpTokens into TokenFarm, total Staking Balance must be increased in the same amount',async function(){
			const [deployer, otherAccount] = await web3.eth.getAccounts();
			const initialStaking = await proxy.methods.totalStakingBalance().call({from: otherAccount})
			const deposit = await proxy.methods.deposit(amountMinted).send({from: otherAccount})
			userTransactions.push({	address: otherAccount, block: deposit.blockNumber, amount: amountMinted, rewards: 0})
			const totalStaking = await proxy.methods.totalStakingBalance().call({from: otherAccount})
			expect(totalStaking).to.equal(initialStaking+amountMinted);
		});
	});

	describe('Que la plataforma distribuya correctamente las recompensas a todos los usuarios en staking', function(){
		it("verificar que totalStakingBalance sume los depositos de cada cuenta", async function () {
			const [deployer, otherAccount, account3, account4] = await web3.eth.getAccounts();
			const amountMinted = '1500';
			const accountsforMint = [account3, account4]
			
			const ownerLp = await lpToken.methods.owner().call();
			
			const totalStakingBefore = await proxy.methods.totalStakingBalance().call({from: deployer})
			
			for (let i = 0; i < accountsforMint.length; i++){
				await lpToken.methods.mint(accountsforMint[i],amountMinted).send({from: ownerLp});
				await lpToken.methods.approve(proxy.options.address, amountMinted).send({from: accountsforMint[i]})
				const deposit = await proxy.methods.deposit(amountMinted).send({from: accountsforMint[i]})
				userTransactions.push({address: accountsforMint[i], block: deposit.blockNumber, amount: amountMinted, rewards: 0})
			}
			const totalStakingAfter = await proxy.methods.totalStakingBalance().call({from: deployer});

			expect(totalStakingAfter-totalStakingBefore).to.be.equal(+amountMinted*accountsforMint.length)
		});
		
		it("Debe calcular correctamente las recompensas por bloque a cada usuario", async function() {
			const [deployer] = await web3.eth.getAccounts();
			const totalStakingBalance = await proxy.methods.totalStakingBalance().call({from: deployer});

			await network.provider.request({method: "evm_increaseTime", params: [100]});
			await network.provider.request({method: "evm_mine", params: []});

			const distributeRewards = await proxy.methods.distributeRewardsAll().send({from: deployer});
			const blockNumber = distributeRewards.blockNumber;
			let estimatedTotalRewards = 0;
			let TotalrewardsDistributed = 0;
			
			for (let i = 0; i < userTransactions.length; i++){
				let {amount, address, block} = userTransactions[i];
				let rewardPerBlock;
				const blocksPassed = Number(blockNumber) - Number(block);
				if (blocksPassed < 100) {
					rewardPerBlock = RewardPerBlock[10];
				}
				if (blocksPassed >= 100 && blocksPassed < 1000) {
					rewardPerBlock = RewardPerBlock[100];
				} 
				if (blocksPassed >= 1000) {
					rewardPerBlock = RewardPerBlock[1000];
				}

				const participation = Number(amount) / Number(totalStakingBalance);
				const userReward = participation * Number(rewardPerBlock) * blocksPassed;
				estimatedTotalRewards += userReward;
				const userInfo = await proxy.methods.getUserInfo(address).call({from: address});
				TotalrewardsDistributed += Number(userInfo.pendingReward)
			}
			const AllStakers = await proxy.methods.getAllStakers().call({from: deployer})
			expect(AllStakers).to.be.instanceOf(Array).and.length(userTransactions.length)
			expect(TotalrewardsDistributed).to.be.equal(estimatedTotalRewards)
		});
	})

	describe("Que un usuario pueda reclamar recompensas y verificar que se transfirieron correctamente a su cuenta.", function(){
		it("when user call claimRewards, then the pending TokenFarm rewards must be 0", async function(){
			const user = userTransactions[0]
			const rewardsClaimed = await proxy.methods.claimRewards().send({from: user.address});
			const userInfo = await proxy.methods.getUserInfo(user.address).call({from: user.address});
			userTransactions[0] = {...user, rewards: rewardsClaimed.events.RewardsClaimed.returnValues._amount}
			expect(Number(userInfo.pendingReward)).to.be.equal(0)
		})
		it("user must have his claimed TokenFarm rewards in DappTokens balance",async function(){
			const user = userTransactions[0]
			const balanceDapp = await dappToken.methods.balanceOf(user.address).call({from: user.address})
			expect(balanceDapp).to.be.equal(user.rewards)
		})
	})

	describe("Que un usuario pueda deshacer el staking de todos los tokens LP depositados y reclamar recompensas pendientes, si las hay.", function(){
		it("when user call withdraw method, his TokenFarms balance must be 0",async function(){
			const user = userTransactions[1]
			await proxy.methods.withdraw().send({from: user.address})
			const userinfo = await proxy.methods.getUserInfo(user.address).call({from: user.address});
			expect(Number(userinfo.stackingBalance)).to.be.equal(0)
		})
		it("after user had been called withdraw TokenFarm method, the raise in balance of LpToken must be the amount",async function(){
			const user = userTransactions[1]
			const lpBalance = await lpToken.methods.balanceOf(user.address).call({from: user.address})
			expect(Number(user.amount)).to.be.equal(Number(lpBalance))
		})
		it("after user had been called withdraw TokenFarm method, it should be able to claimRewards and receive in DappToken the pending rewards", async function () {
			const user = userTransactions[1]
			const balanceBeforeRewards = await dappToken.methods.balanceOf(user.address).call({from: user.address})
			const rewardsClaimed = await proxy.methods.claimRewards().send({from: user.address});
			const balanceAfterRewards = await dappToken.methods.balanceOf(user.address).call({from: user.address})

			expect(Number(rewardsClaimed.events.RewardsClaimed.returnValues._amount)).to.be.equal(Number(balanceAfterRewards)-Number(balanceBeforeRewards))
		})
	})
});