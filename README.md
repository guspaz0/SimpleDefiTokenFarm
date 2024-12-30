# Simple Defi Token Farm Smart Contract

Este es un proyecto final para el curso de Blockchain de la alianza de ETH-KIPU con Henry, del cual eh tenido la oportunidad de ser becado.

Para mas informacion sobre contratos de farming, sirvase este sitio:
[Cómo usar Farms (Yield Farming) en PancakeSwap](https://docs.pancakeswap.finance/products/yield-farming/how-to-use-farms)

Para inicializar el proyecto debes tener el framework hardhat instalado:

Comando para ayuda de hardhat:
```shell
npx hardhat help
```
---
## TokenFarm "V1"
La version "original" del Smart Contract pero modificada para ser 'upgradeable' mediante un Proxie transparente y actualizable por el Proxy Admin del mismo. 

Esta Compuesto por 5 Smart Contracts: 
- DappToken:    Usado para que los usuarios "stakers" puedan cobrar sus recompensas.
- LpToken:Usado para que los usuarios realizen sus depositos al Stack.
- TokenFarm: el contrato Defi en si, con la logica del negocio.
- Proxy: contrato intermediario usado para interactuar con los usuarios y la logica del negocio, es decir con el TokenFarm.
- Proxy Admin:  contrato usado para actualizar el proxy con las futuras nuevas versiones de TokenFarm.

Los test estan escritos todos con Web3 y libreria Chai
Comando para correr los tests:
```shell
npx hardhat test test/TokenFarm.test.ts
```

Comando para levantar el nodo local de hardhat y deployar:
```shell
#Levantar el nodo local
npx hardhat node

#Deploy de la version 1
npx hardhat ignition deploy ignition/modules/TokenFarm.ts --network localhost
```
Esto levantara el nodo local hardhat y hara el deploy de 5 Smart Contracts:

---
## TokenFarm "V2"

Ademas de toda la funcionalidad de la V1, en este Smart Contract se agrega la posibilidad de establecer una comision "fee", aplicada sobre las rempenzas que retiran los usuarios stakers, y que el propietario pueda retirar dichas comisiones.

Comando para correr los tests:
```shell
npx hardhat test test/TokenFarmV2.test.ts
```

Comando para levantar el nodo local de hardhat y deployar:
```shell
#Levantar el nodo local
npx hardhat node

#Deploy de la version 2
npx hardhat ignition deploy ignition/modules/TokenFarmV2.ts --network localhost
```
Este comando de deploy de ignition, utiliza el deploy de la V1 y ademas deployara TokenFarmV2 y hara la llamada "upgradeAndCall" al ProxyAdmin.

---

### Variables de entorno

Es posible deployar en la blockchain real de Ethereum, previamente editando el archivo hardhat-config.js y seteando las API keys correspondientes.


Para setear variables de entorno, se recomienda usar "vars" de hardhat, ya que las guarda encriptadas, 

Ejemplos de codigo:

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