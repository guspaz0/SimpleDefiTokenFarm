import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-web3-v4";
// import { vars } from "hardhat/config";
// import { web3 } from "hardhat";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

// task action function receives the Hardhat Runtime Environment as second argument
// task("accounts","Prints accounts", async (__dirname,{web3})=> {
//   console.log(await web3.eth.getAccounts());
// })

export default config;
