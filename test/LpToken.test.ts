import { web3 } from 'hardhat';
import LPtokenArtifact from '../artifacts/contracts/LPtoken.sol/LPtoken.json';

async function deployLpTokenFixture() {
    const LpTokenContract = new web3.eth.Contract(LPtokenArtifact.abi);
    LpTokenContract.handleRevert = true;

    const [deployerLp, otherAccount, otherAccount2] = await web3.eth.getAccounts();
    const rawContract = LpTokenContract.deploy({
        data: LPtokenArtifact.bytecode,
        arguments: [deployerLp],
    });

    // To know how much gas will be consumed, we can estimate it first.
    const estimateGas = await rawContract.estimateGas({from: deployerLp});

    const LpToken = await rawContract.send({
        from: deployerLp,
        gas: estimateGas.toString(),
        gasPrice: '10000000000',
    });

    //console.log('LpToken    contract deployed to: ', LpToken.options.address);
    return { LpToken, deployerLp, otherAccount2, LpTokenContract };
}

export default deployLpTokenFixture