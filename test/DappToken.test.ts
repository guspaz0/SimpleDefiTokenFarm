import { web3 } from 'hardhat';
import DappTokenArtifact from '../artifacts/contracts/DappToken.sol/DappToken.json';

export default async function deployDappTokenFixture() {
    const DappTokenContract = new web3.eth.Contract(DappTokenArtifact.abi);
    DappTokenContract.handleRevert = true;

    const [deployerDapp, otherAccount] = await web3.eth.getAccounts();
    const rawContract = DappTokenContract.deploy({
        data: DappTokenArtifact.bytecode,
        arguments: [deployerDapp],
    });

    // To know how much gas will be consumed, we can estimate it first.
    const estimateGas = await rawContract.estimateGas({from: deployerDapp});

    const DappToken = await rawContract.send({
        from: deployerDapp,
        gas: estimateGas.toString(),
        gasPrice: '10000000000',
    });

    //console.log('DappToken  contract deployed to: ', DappToken.options.address);
    return { DappToken, deployerDapp, otherAccount, DappTokenContract };
}