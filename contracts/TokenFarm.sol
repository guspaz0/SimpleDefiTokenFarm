// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DappToken} from "./DappToken.sol";
import {LPToken} from "./LPToken.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TokenFarm is ReentrancyGuard, Initializable, OwnableUpgradeable {
    using SafeERC20 for LPToken;
    //
    // Variables de estado
    //
    string constant public name = "Proportional Token Farm";
    DappToken public dappToken;
    LPToken public lpToken;
    mapping(uint256 => uint256) public RewardPerBlock;
    uint256 public totalStakingBalance;

    address[] internal stakers;

    struct StructUser {
        uint256 stackingBalance;    // balance de stacking del usuario
        uint256 checkpoint;         // ultimo bloque de stacking del usuario
        uint256 pendingReward;      // recompensas pendientes
        bool hasStaked;             // si el usuario hizo staking alguna vez
        bool isStaking;             // si el usuario tiene un staking actualmente
    }
    
    mapping(address => StructUser) internal users;


    event Deposit(address indexed _sender, uint256 _amount);
    event Withdraw(address indexed _sender, uint256 _amount);
    event RewardsClaimed(address indexed _sender, uint256 _amount);
    event RewardsDistributed(string message);
    event RangeRewardUpdated(uint256 _range, uint256 _reward);

    constructor(){
        _disableInitializers();
    }

    function initialize(
        address InitialOwner,
        DappToken _dappToken, 
        LPToken _lpToken,
        uint256 _range10, 
        uint256 _range100, 
        uint256 _range1000
    ) public virtual initializer {
        __Ownable_init(InitialOwner);
        dappToken = _dappToken;
        lpToken = _lpToken;
        RewardPerBlock[10] = _range10;
        RewardPerBlock[100] = _range100;
        RewardPerBlock[1000] = _range1000;
    }

    modifier onlyStaker() {
        StructUser memory user = users[msg.sender];
        require(user.hasStaked, "solo usuarios con stacking pueden operar");
        _;
    }

    
    function version() virtual public pure returns (string memory) {
        return "1.0.0";
    }

    function getAllStakers() public view onlyOwner returns(address[] memory _stakers) {
        return stakers;
    }

    function getUserInfo(address _Addr) public view onlyStaker returns(StructUser memory _users) {
        return users[_Addr];
    }

    function deposit(uint256 _Amount) external nonReentrant {
        require(_Amount > 0, "La cantidad no puede ser menor a 0");
        bool success = lpToken.transferFrom(msg.sender, address(this), _Amount);
        require(success, "Error in transfer from LpToken");

        StructUser storage user = users[msg.sender];
        if (!user.hasStaked){
            users[msg.sender] = StructUser(
                _Amount,        //uint256 stackingBalance;
                block.number,   //uint256 checkpoint;
                0,              //uint256 pendingReward;
                true,           //bool hasStaked;
                true            //bool isStaking;
            );
            stakers.push(msg.sender);
        } else {
            user.stackingBalance += _Amount;
        }
        totalStakingBalance += _Amount;
        
        distributeRewards(msg.sender);
        
        emit Deposit(msg.sender, _Amount);
    }
       /**
     * @notice Reclama recompensas pendientes.
     */
    function claimRewards() virtual external {
        StructUser storage user = users[msg.sender];
        // Obtener el monto de recompensas pendientes del usuario desde pendingRewards.
        uint256 pendingAmount = user.pendingReward;
        // Verificar que el monto de recompensas pendientes sea mayor a 0.
        require(pendingAmount > 0,"el monto de recompensas debe ser mayor a 0");
        // Restablecer las recompensas pendientes del usuario a 0.
        user.pendingReward = 0;
        // Llamar a la función de acuñación (mint) en el contrato DappToken para transferir las recompensas al usuario.
        dappToken.mint(msg.sender, pendingAmount);
        // Emitir un evento de reclamo de recompensas.
        emit RewardsClaimed(msg.sender, pendingAmount);
    }

    function updateRewardRange(uint256 range, uint256 reward) public onlyOwner {
        require(range == 10 || range == 100 || range == 1000, "the range provided does`nt exist");
        RewardPerBlock[range] = reward;
        emit RangeRewardUpdated(range, reward);
    }

    /**
     * @notice Distribuye recompensas a todos los usuarios en staking.
     */
    function distributeRewardsAll() external onlyOwner {
        // Verificar que la llamada sea realizada por el owner.
        // Iterar sobre todos los usuarios en staking almacenados en el array stakers.
        for (uint i = 0; i < stakers.length; i++) {
            address userAddress = stakers[i];
            // Para cada usuario, si están haciendo staking (isStaking == true), llamar a distributeRewards.
            if (users[userAddress].isStaking == true) {
                distributeRewards(userAddress);
            }
        }
        // Emitir un evento indicando que las recompensas han sido distribuidas.
        
        emit RewardsDistributed("recompensas distribuidas");
    }
    /**
     * @notice Retira todos los tokens LP en staking.
     */
    function withdraw() external onlyStaker nonReentrant {
        StructUser storage user = users[msg.sender];
        uint256 balance = user.stackingBalance;
        // Verificar que el balance de staking sea mayor a 0.
        require(balance > 0, "el balance del Stack del usuario no es mayor a cero");
        // Transferir los tokens LP de vuelta al usuario.
        bool success = lpToken.transfer(msg.sender, balance);
        require(success,"Error al transferir LpToken");
        // Llamar a distributeRewards para calcular y actualizar las recompensas pendientes antes de restablecer el balance.
        distributeRewards(msg.sender);
        // Restablecer stakingBalance del usuario a 0.
        user.stackingBalance = 0;
        // Reducir totalStakingBalance en el balance que se está retirando.
        totalStakingBalance -= balance;
        // Actualizar isStaking del usuario a false.
        user.isStaking = false;   
        // Emitir un evento de retiro.
        emit Withdraw(msg.sender, balance);
    }
    
    function distributeRewards(address beneficiary) private {
        // Obtener el último checkpoint del usuario desde checkpoints.
        StructUser storage user = users[beneficiary];

        // Calcular la cantidad de bloques transcurridos desde el último checkpoint.
        uint256 blocksPassed = block.number - user.checkpoint;
        // Verificar que el número de bloque actual sea mayor al checkpoint y que totalStakingBalance sea mayor a 0.
        if (blocksPassed == 0) {
            return;
        }
        if (totalStakingBalance == 0) {
            return;
        }
        // Calcular la proporción del staking del usuario en relación al total staking (stakingBalance[beneficiary] / totalStakingBalance).
        uint256 participation = (user.stackingBalance * 1e18) / totalStakingBalance;
        // Calcular las recompensas del usuario multiplicando la proporción por REWARD_PER_BLOCK y los bloques transcurridos.
        uint256 rewardPerBlock;
        if (blocksPassed < 100) {
            rewardPerBlock = RewardPerBlock[10];
        }
        if (blocksPassed >= 100 && blocksPassed < 1000) {
            rewardPerBlock = RewardPerBlock[100];
        } 
        if (blocksPassed >= 1000) {
            rewardPerBlock = RewardPerBlock[1000];
        }
        uint256 userReward = (participation * rewardPerBlock * blocksPassed)/1e18;
        // Actualizar las recompensas pendientes del usuario en pendingRewards.
        user.pendingReward = userReward;

        // Actualizar el checkpoint del usuario al bloque actual.
        user.checkpoint = block.number;
    }
}