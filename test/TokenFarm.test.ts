import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3, network } from 'hardhat';
import TokenFarmArtifact from '../artifacts/contracts/TokenFarm.sol/TokenFarm.json';
import deployLpTokenFixture from './LpToken.test';
import deployDappTokenFixture from './DappToken.test';

describe('TokenFarm', function () {

	let REWARD_PER_BLOCK = {10: 1e9, 100: 1e12, 1000: 1e18}

	async function deployTokenFarmFixture() {
		const { DappToken } = await loadFixture(deployDappTokenFixture)
		const { LpToken } = await loadFixture(deployLpTokenFixture)
		const TokenFarmContract = new web3.eth.Contract(TokenFarmArtifact.abi);
		TokenFarmContract.handleRevert = true;

		const [deployer, otherAccount] = await web3.eth.getAccounts();
		const rawContract = TokenFarmContract.deploy({
			data: TokenFarmArtifact.bytecode,
			arguments: [
				DappToken.options.address, 
				LpToken.options.address,
				REWARD_PER_BLOCK[10], //reward per block in range 10
				REWARD_PER_BLOCK[100], //reward per block in range 100
				REWARD_PER_BLOCK[1000]  //reward per block in range 1000
			],
		});

		const estimateGas = await rawContract.estimateGas({from: deployer});

		const TokenFarm = await rawContract.send({
			from: deployer,
			gas: estimateGas.toString(),
			gasPrice: '10000000000'
		});

		return { TokenFarm, deployer, TokenFarmContract, DappToken, LpToken, otherAccount };
	}
	let dappToken: any;
	let lpToken: any;
	let tokenFarm: any;
	let userTransactions: Array<{address: string, block: string, amount: string, rewards: any}> = []

	this.beforeAll(async function(){
		const {	TokenFarm, deployer, DappToken, LpToken} = await loadFixture(deployTokenFarmFixture)
		await DappToken.methods.transferOwnership(TokenFarm.options.address).send({from: deployer})
		dappToken = DappToken;
		lpToken = LpToken;
		tokenFarm = TokenFarm;
	})

	it('The owner of DappToken must be TokenFarm', async function () {
		const ownerDappToken = await dappToken.methods.owner().call();
		expect(ownerDappToken).to.equal(tokenFarm.options.address);
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
			const initialAllowance = await lpToken.methods.allowance(otherAccount, tokenFarm.options.address).call({from: otherAccount});
			await lpToken.methods.approve(tokenFarm.options.address, amountMinted).send({from: otherAccount})
			const currentAllowance = await lpToken.methods.allowance(otherAccount, tokenFarm.options.address).call({from: otherAccount});
			expect(currentAllowance).to.equal(initialAllowance+amountMinted);
		});

		it('After deposit LpTokens into TokenFarm, total Staking Balance must be increased in the same amount',async function(){
			const [deployer, otherAccount] = await web3.eth.getAccounts();
			const initialStaking = await tokenFarm.methods.totalStakingBalance().call({from: otherAccount})
			const deposit = await tokenFarm.methods.deposit(amountMinted).send({from: otherAccount})
			userTransactions.push({	address: otherAccount, block: deposit.blockNumber, amount: amountMinted, rewards: 0})
			const totalStaking = await tokenFarm.methods.totalStakingBalance().call({from: otherAccount})
			expect(totalStaking).to.equal(initialStaking+amountMinted);
		});


	});
	describe('Que la plataforma distribuya correctamente las recompensas a todos los usuarios en staking', function(){
		it("verificar que totalStakingBalance sume los depositos de cada cuenta", async function () {
			const [deployer, otherAccount, account3, account4] = await web3.eth.getAccounts();
			const amountMinted = '1500';
			const accountsforMint = [account3, account4]
			
			const ownerLp = await lpToken.methods.owner().call();
			
			const totalStakingBefore = await tokenFarm.methods.totalStakingBalance().call({from: deployer})
			
			for (let i = 0; i < accountsforMint.length; i++){
				await lpToken.methods.mint(accountsforMint[i],amountMinted).send({from: ownerLp});
				await lpToken.methods.approve(tokenFarm.options.address, amountMinted).send({from: accountsforMint[i]})
				const deposit = await tokenFarm.methods.deposit(amountMinted).send({from: accountsforMint[i]})
				userTransactions.push({address: accountsforMint[i], block: deposit.blockNumber, amount: amountMinted, rewards: 0})
			}
			const totalStakingAfter = await tokenFarm.methods.totalStakingBalance().call({from: deployer});

			expect(totalStakingAfter-totalStakingBefore).to.be.equal(+amountMinted*accountsforMint.length)
		});
		
		it("Debe calcular correctamente las recompensas por bloque a cada usuario", async function() {
			const [deployer] = await web3.eth.getAccounts();
			const totalStakingBalance = await tokenFarm.methods.totalStakingBalance().call({from: deployer});

			await network.provider.request({method: "evm_increaseTime", params: [100]});
			await network.provider.request({method: "evm_mine", params: []});

			const distributeRewards = await tokenFarm.methods.distributeRewardsAll().send({from: deployer});
			const blockNumber = distributeRewards.blockNumber;
			let estimatedTotalRewards = 0;
			let TotalrewardsDistributed = 0;
			
			for (let i = 0; i < userTransactions.length; i++){
				let {amount, address, block} = userTransactions[i];
				let rewardPerBlock;
				const blocksPassed = Number(blockNumber) - Number(block);
				if (blocksPassed <= 10) {
					rewardPerBlock = REWARD_PER_BLOCK[10]
				} else if (blocksPassed <= 100) {
					rewardPerBlock = REWARD_PER_BLOCK[100]
				} else if (blocksPassed <= 1000) {
					rewardPerBlock = REWARD_PER_BLOCK[1000]
				}
				//const REWARD_PER_BLOCK = await tokenFarm.methods.REWARD_PER_BLOCK().call({from: deployer});
				const participation = Number(amount) / Number(totalStakingBalance);
				const userReward = participation * Number(rewardPerBlock) * blocksPassed;
				estimatedTotalRewards += userReward;
				const userInfo = await tokenFarm.methods.users(address).call({from: address});
				TotalrewardsDistributed += Number(userInfo.pendingReward)
			}
			expect(TotalrewardsDistributed).to.be.equal(estimatedTotalRewards)
		});
	})

	describe("Que un usuario pueda reclamar recompensas y verificar que se transfirieron correctamente a su cuenta.", function(){
		it("when user call claimRewards, then the pending TokenFarm rewards must be 0", async function(){
			const user = userTransactions[0]
			const rewardsClaimed = await tokenFarm.methods.claimRewards().send({from: user.address});
			const userInfo = await tokenFarm.methods.users(user.address).call({from: user.address});
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
			
			await tokenFarm.methods.withdraw().send({from: user.address})
			const userinfo = await tokenFarm.methods.users(user.address).call({from: user.address});
			expect(Number(userinfo.stackingBalance)).to.be.equal(0)
		})
		it("after user had been called withdraw TokenFarm method, the raise in balance of LpToken must be the same amount",async function(){
			const user = userTransactions[1]
			const lpBalance = await lpToken.methods.balanceOf(user.address).call({from: user.address})
			expect(Number(user.amount)).to.be.equal(Number(lpBalance))
		})
		it("after user had been called withdraw TokenFarm method, it should be able to claimRewards and receive in DappToken the pending rewards", async function () {
			const user = userTransactions[1]
			const balanceBeforeRewards = await dappToken.methods.balanceOf(user.address).call({from: user.address})
			const rewardsClaimed = await tokenFarm.methods.claimRewards().send({from: user.address});
			const balanceAfterRewards = await dappToken.methods.balanceOf(user.address).call({from: user.address})

			expect(Number(rewardsClaimed.events.RewardsClaimed.returnValues._amount)).to.be.equal(Number(balanceAfterRewards)-Number(balanceBeforeRewards))
		})
	})
	describe("The owner can be able to change the reward per static range of blocks", function(){
		it("when the owner call the modifier method, it should be saved", async function(){
			const [owner] = await web3.eth.getAccounts();
			const updatedReward = await tokenFarm.methods.updateRewardRange(10,1e15).send({from: owner})
			expect(Number(updatedReward.events.RangeRewardUpdated.returnValues._reward)).to.be.equal(1e15);
		}) 
	})

});