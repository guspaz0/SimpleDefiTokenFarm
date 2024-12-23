import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// deploy command
// npx hardhat ignition deploy ignition/modules/SimpleBank.ts --network <network> --verify

const BASIS_POINTS_FEE = 100; // Default 1% fee (100 basis points)
const Owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Replace with actual treasury address

const SimpleBankModule = buildModule("SimpleBankModule", (m) => {
  const fee = m.getParameter("fee", BASIS_POINTS_FEE);
  const treasury = m.getParameter("treasury", TREASURY_ADDRESS);

  const simpleBank = m.contract("SimpleBank", [fee, treasury]);

  return { simpleBank };
});

export default SimpleBankModule;