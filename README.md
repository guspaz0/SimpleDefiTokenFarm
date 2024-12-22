# Simple Defi Smart Contracts "Token Farm"

Este es un proyecto final para el curso de Blockchain de la alianza de ETH-KIPU con Henry, del cual eh tenido la oportunidad de ser becado.

Para mas informacion sobre contratos de farming, sirvase este sitio:
[Cómo usar Farms (Yield Farming) en PancakeSwap](https://docs.pancakeswap.finance/products/yield-farming/how-to-use-farms)

Para inicializar el proyecto debes tener el framework hardhat instalado:

Intenta correr algunos de estos comandos:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
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