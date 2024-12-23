// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DappToken} from "./DappToken.sol";
import {LPToken} from "./LPToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenFarm is ReentrancyGuard {
    //
    // Variables de estado
    //
    string constant public name = "Proportional Token Farm";
    address public owner;
    DappToken public dappToken;
    LPToken public lpToken;
    mapping(uint256 => uint256) public Reward_Per_Block;
    uint256 public totalStakingBalance;
    uint256 public fee;
    uint256 private feeBalance = 0;

    address[] public stakers;

    struct structUser {
        uint256 stackingBalance;    // balance de stacking del usuario
        uint256 checkpoint;         // ultimo bloque de stacking del usuario
        uint256 pendingReward;      // recompensas pendientes
        bool hasStaked;             // si el usuario hizo staking alguna vez
        bool isStaking;             // si el usuario tiene un staking actualmente
    }
    
    mapping(address => structUser) public users;

    // Eventos
    // Agregar eventos para Deposit, Withdraw, RewardsClaimed y RewardsDistributed.
    event Deposit(address indexed _sender, uint256 _amount);

    event Withdraw(address indexed _sender, uint256 _amount);

    event RewardsClaimed(address indexed _sender, uint256 _amount);

    event RewardsDistributed(string message);

    event RangeRewardUpdated(uint256 _range, uint256 _reward);

    event FeeClaimed(uint256 _amount);

    // Constructor
    constructor(
        DappToken _dappToken, 
        LPToken _lpToken,
        uint256 _fee,
        uint256 _range10, 
        uint256 _range100, 
        uint256 _range1000
    ) {
        // Configurar las instancias de los contratos de DappToken y LPToken.
        // Configurar al owner del contrato como el creador de este contrato.
        dappToken = _dappToken;
        lpToken = _lpToken;
        fee = _fee;
        Reward_Per_Block[10] = _range10;
        Reward_Per_Block[100] = _range100;
        Reward_Per_Block[1000] = _range1000;
        owner = msg.sender;
    }

    modifier onlyStaker() {
        require(users[msg.sender].isStaking, "solo usuarios con stacking pueden operar");
        _;
    }
    modifier onlyOwner() {
        require(owner == msg.sender, "solo el propietario puede operar");
        _;
    }

    function deposit(uint256 _amount) external nonReentrant {
        // Verificar que _amount sea mayor a 0.
        require(_amount > 0, "La cantidad no puede ser menor a 0");
        // Transferir tokens LP del usuario a este contrato.
        bool success = lpToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Error in transfer from LpToken");

        structUser storage user = users[msg.sender];
        if (!user.hasStaked){
            users[msg.sender] = structUser(
                _amount,        //uint256 stackingBalance;
                block.number,   //uint256 checkpoint;
                0,              //uint256 pendingReward;
                true,           //bool hasStaked;
                true            //bool isStaking;
            );
            stakers.push(msg.sender);
        } else {
            user.stackingBalance += _amount;
        }
        // Actualizar el balance de staking del usuario en stakingBalance.
        totalStakingBalance += _amount;
        
        // Llamar a distributeRewards para calcular y actualizar las recompensas pendientes.
        distributeRewards(msg.sender);
        
        // Emitir un evento de depósito.
        emit Deposit(msg.sender, _amount);
    }
       /**
     * @notice Reclama recompensas pendientes.
     */
    function claimRewards() external {
        structUser storage user = users[msg.sender];
        // Obtener el monto de recompensas pendientes del usuario desde pendingRewards.
        uint256 pendingAmount = user.pendingReward;
        // Verificar que el monto de recompensas pendientes sea mayor a 0.
        require(pendingAmount > 0,"el monto de recompensas debe ser mayor a 0");
        uint256 retainFee = (user.pendingReward*1e18 * fee/100)/1e18;
        feeBalance += retainFee;
        // Restablecer las recompensas pendientes del usuario a 0.
        user.pendingReward = 0;
        // Llamar a la función de acuñación (mint) en el contrato DappToken para transferir las recompensas al usuario.
        dappToken.mint(msg.sender, pendingAmount-retainFee);
        // Emitir un evento de reclamo de recompensas.
        emit RewardsClaimed(msg.sender, pendingAmount-retainFee);
    }

    function updateRewardRange(uint256 range, uint256 reward) public onlyOwner {
        require(range == 10 || range == 100 || range == 1000, "the range provided does`nt exist");
        Reward_Per_Block[range] = reward;
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
        structUser storage user = users[msg.sender];
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
    
    function distributeRewards(address beneficiary) private {
        // Obtener el último checkpoint del usuario desde checkpoints.
        structUser storage user = users[beneficiary];

        // Calcular la cantidad de bloques transcurridos desde el último checkpoint.
        uint256 blocksPassed = block.number - user.checkpoint;
        // Verificar que el número de bloque actual sea mayor al checkpoint y que totalStakingBalance sea mayor a 0.
        if (blocksPassed == 0 || totalStakingBalance == 0) {
            return;
        }
        
        // Calcular la proporción del staking del usuario en relación al total staking (stakingBalance[beneficiary] / totalStakingBalance).
        uint256 participation = (user.stackingBalance * 1e18) / totalStakingBalance;
        // Calcular las recompensas del usuario multiplicando la proporción por REWARD_PER_BLOCK y los bloques transcurridos.
        uint256 rewardPerBlock;
        if(blocksPassed <= 10) {
            rewardPerBlock = Reward_Per_Block[10];
        } else if (blocksPassed <= 100) {
            rewardPerBlock = Reward_Per_Block[100];
        } else if (blocksPassed <= 1000) {
            rewardPerBlock = Reward_Per_Block[1000];
        }
        uint256 userReward = (participation * rewardPerBlock * blocksPassed)/1e18;
        // Actualizar las recompensas pendientes del usuario en pendingRewards.
        user.pendingReward = userReward;

        // Actualizar el checkpoint del usuario al bloque actual.
        user.checkpoint = block.number;
    }
}