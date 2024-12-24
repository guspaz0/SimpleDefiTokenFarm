import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import DappToken from './DappToken'
import LPToken from './LpToken'

// deploy command
// npx hardhat ignition deploy ignition/modules/SimpleBank.ts --network <network> --verify

const Owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const RewardPerBlock = {10: 1e9, 100: 1e12, 1000: 1e15}
const fee = 3;

const TokenFarm = buildModule("TokenFarm", (m) => {

  const { dappToken, addrDapp } = m.useModule(DappToken);
  const { lpToken, addrLp } = m.useModule(LPToken); 

  const tokenFarm = m.contract("TokenFarm",[
    Owner,
    addrDapp,
    addrLp,
    fee,
    RewardPerBlock[10],
    RewardPerBlock[100],
    RewardPerBlock[1000]
  ])

  return { dappToken, lpToken, tokenFarm };
});

export default TokenFarm;