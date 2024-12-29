// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TokenFarm.sol";

contract TokenFarmV2 is TokenFarm {
    //
    // Variables de estado
    //
    uint256 public fee;
    uint256 private feeBalance = 0;

    event FeeClaimed(uint256 _amount);

    function setFee(
        uint256 _fee
    ) public {
        fee = _fee;
    }

    
    function version() public virtual override pure returns (string memory) {
        return "2.0.0";
    }

       /**
     * @notice Reclama recompensas pendientes.
     */
     function claimRewards() override external {
        structUser storage user = users[msg.sender];
        uint256 pendingAmount = user.pendingReward;
        require(pendingAmount > 0,"el monto de recompensas debe ser mayor a 0");
        uint256 retainFee = (user.pendingReward*1e18 * fee/100)/1e18;
        feeBalance += retainFee;
        user.pendingReward = 0;
        dappToken.mint(msg.sender, pendingAmount-retainFee);
        emit RewardsClaimed(msg.sender, pendingAmount-retainFee);
    }

    /**
    *@notice El owner puede retirar los fees obtenidos por las recompensas de los usuarios
     */
    function withdrawFee() external onlyOwner {
        require(feeBalance > 0, "fee balance must be greater than 0");
        uint256 feeAvailable = feeBalance;
        feeBalance = 0;
        dappToken.mint(msg.sender, feeAvailable);
        emit FeeClaimed(feeAvailable);
    }
}