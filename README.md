# Simple Defi Smart Contracts "Token Farm"

Este es un proyecto final para el curso de Blockchain de la alianza de ETH-KIPU con Henry, del cual eh tenido la oportunidad de ser becado.

Para mas informacion sobre contratos de farming, sirvase este sitio:
[Cómo usar Farms (Yield Farming) en PancakeSwap](https://docs.pancakeswap.finance/products/yield-farming/how-to-use-farms)

Para inicializar el proyecto debes tener el framework hardhat instalado:

Comando para ayuda de hardhat:
```shell
npx hardhat help
```

Los test estan escritos todos con Web3 y libreria Chai
Comando para correr los tests:
```shell
npx hardhat test
```

Comando para levantar el nodo local de hardhat:
```shell
npx hardhat node
```

Para deployar los contratos, esta disponible de dos maneras:
- con Ignition:
```shell
npx hardhat ignition deploy ignition/modules/TokenFarm.ts --network localhost
```

- con Web3.js:
```shell
npx hardhat run scripts/deploy.ts --network localhost
```


Para setear variables de entorno, usar "vars" de hardhat:

```shell
## algunos ejemplos de variables de entorno:
npx hardhat vars set ETHERSCAN_API_KEY
npx hardhat vars set SEPOLIA_API_KEY
npx hardhat vars set ALCHEMY_API_KEY

```
Donde:
- Etherscan es un sitio para deployar y verificar smart contracts.
- Sepolia es una red de pruebas ethereum.
- Alchemy es un servicio donde se puede deployar nuestro chain (nodo con hardhat) en la blockchain.
