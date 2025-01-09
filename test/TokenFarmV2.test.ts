import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3, network } from 'hardhat';
import deployTokenFarmV2Fixture from './fixtures/FixtureTokenFarmV2';

describe('TokenFarmV2', function () {

    let RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e15}
    const fee = 3;
    let dappToken: any;
    let lpToken: any;
    let tokenFarm: any;
    let proxy: any;
    let userTransactions: Array<{address: string, block: string, amount: string, rewards: any}> = []

    this.beforeAll(async function(){
        try {
            const {	TokenFarmV2, deployer, Proxy, TokenFarm, ProxyAdmin, DappToken, LpToken} = await loadFixture(deployTokenFarmV2Fixture)

            dappToken = DappToken;
            lpToken = LpToken;
            tokenFarm = TokenFarmV2;
            proxy = Proxy;
        } catch(e) {
            console.log(e)
        }
    })

    it('The owner of DappToken must be TokenFarm', async function () {
        const [deployer, otherAccount] = await web3.eth.getAccounts();
        await dappToken.methods.transferOwnership(proxy.options.address).send({from: deployer})
        const ownerDappToken = await dappToken.methods.owner().call();
        expect(ownerDappToken).to.equal(proxy.options.address);
    });

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
        it("If user pendingRewards are 0, an error must be returned", async function(){
            const user = userTransactions[0]
            try {
                await proxy.methods.claimRewards().send({from: user.address})
            } catch (e) {
                expect(e).to.be.revertedWith("el monto de recompensas debe ser mayor a 0")
            }
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
        it("user must have his claimed TokenFarm rewards in DappTokens balance",async function(){
			const user = userTransactions[0]
			const balanceDapp = await dappToken.methods.balanceOf(user.address).call({from: user.address})
			expect(balanceDapp).to.be.equal(user.rewards)
		})
    })
	describe("The owner can be able to change the reward per static range of blocks", function() {
		it("If the range provided to update doesn't exist in the mapping, it should be an error",async function() {
			const owner = await proxy.methods.owner().call();
			try {
				await proxy.methods.updateRewardRange(150, 1e11).send({from: owner})
			} catch (e) {
				expect(e).to.be.revertedWith("the range provided does`nt exist")
			}
		})
        it("when the owner call updateRewardRange method, it should be saved", async function() {
            const [owner] = await web3.eth.getAccounts();
            const updatedReward = await proxy.methods.updateRewardRange(10,1e10).send({from: owner});
            expect(Number(updatedReward.events.RangeRewardUpdated.returnValues._reward)).to.be.equal(1e10);
			const updatedRewar2 = await proxy.methods.updateRewardRange(100,1e12).send({from: owner});
			expect(Number(updatedRewar2.events.RangeRewardUpdated.returnValues._reward)).to.be.equal(1e12);
			const updatedRewar3 = await proxy.methods.updateRewardRange(1000,1e15).send({from: owner});
			expect(Number(updatedRewar3.events.RangeRewardUpdated.returnValues._reward)).to.be.equal(1e15);
        })
    })
    
    describe("Despues de actualizar el contrato a V2, el Owner de TokenFarm puede retirar los fee obtenidos por las recompensas de los usuarios", function() {
        it("The initializer function, setFee, cannot be called again", async function(){
            const owner = await proxy.methods.owner().call();
            try {
                await proxy.methods.setFee(
                    fee,
                ).call({from: owner})
            } catch (e) {
                expect(e).to.be.revertedWith("")
            }
        })
        
        it("Token farm version must be V2", async function(){
            const [owner] = await web3.eth.getAccounts();
            const version = await proxy.methods.version().call({from: owner})
            expect(version).to.be.equal("2.0.0")
        })
        it("the fee tax must be a number greater than 0 and less than 100",async function(){
            const [owner] = await web3.eth.getAccounts();
            const fee = await proxy.methods.fee().call({from: owner});
            expect(fee).to.be.gt(0).and.lt(100)
        })
        it("Only the owner can call witdrawFee", async function(){
            const [owner, otherAccount] = await web3.eth.getAccounts();
            try {
                await proxy.methods.withdrawFee().send({from: otherAccount})
            } catch (e) {
                expect(e).to.be.revertedWith("")
            }
        })
        it("after the owner call withdrawFee, it should receive the amount in DappTokens", async function() {
            const owner = await proxy.methods.owner().call();
            const balanceBefore = await dappToken.methods.balanceOf(owner).call({from: owner});
            const withdrawFee = await proxy.methods.withdrawFee().send({from: owner});
            expect(withdrawFee).to.be.ok
            const balanceAfter = await dappToken.methods.balanceOf(owner).call({from: owner});
            expect(Number(withdrawFee.events.FeeClaimed.returnValues._amount)).to.be.equal(Number(balanceAfter)-Number(balanceBefore))
        })
        it("If fee balance is 0, an error must be returned", async function(){
            const [owner, otherAccount] = await web3.eth.getAccounts();
            try {
                await proxy.methods.withdrawFee().send({from: otherAccount})
            } catch (e) {
                expect(e).to.be.revertedWith("fee balance must be greater than 0")
            }
        })

    })

});