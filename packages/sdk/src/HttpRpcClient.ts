import { ethers, JsonRpcProvider, resolveProperties } from 'ethers'
import { UserOperationStruct } from '@account-abstraction/utils/src/ContractTypes'
import Debug from 'debug'
import { deepHexlify } from '@account-abstraction/utils'

const debug = Debug('aa.rpc')

export class HttpRpcClient {
  private readonly userOpJsonRpcProvider: JsonRpcProvider

  initializing: Promise<void>

  constructor (
    readonly bundlerUrl: string,
    readonly entryPointAddress: string,
    readonly chainId: number
  ) {
    if (bundlerUrl === '') {
      this.userOpJsonRpcProvider = null as any
      this.initializing = null as any
      return
    }
    this.userOpJsonRpcProvider = new ethers.JsonRpcProvider(this.bundlerUrl, {
      name: 'Connected bundler network',
      chainId
    })
    this.initializing = this.validateChainId()
  }

  async validateChainId (): Promise<void> {
    // validate chainId is in sync with expected chainid
    const chain = await this.userOpJsonRpcProvider.send('eth_chainId', [])
    const bundlerChain = parseInt(chain)
    if (bundlerChain !== this.chainId) {
      throw new Error(`bundler ${this.bundlerUrl} is on chainId ${bundlerChain}, but provider is on chainId ${this.chainId}`)
    }
  }

  /**
   * send a UserOperation to the bundler
   * @param userOp1
   * @return userOpHash the id of this operation, for getUserOperationTransaction
   */
  async sendUserOpToBundler (userOp1: UserOperationStruct): Promise<string> {
    await this.initializing
    const hexifiedUserOp = deepHexlify(await resolveProperties(userOp1))
    const jsonRequestData: [UserOperationStruct, string] = [hexifiedUserOp, this.entryPointAddress]
    await this.printUserOperation('eth_sendUserOperation', jsonRequestData)
    return await this.userOpJsonRpcProvider
      .send('eth_sendUserOperation', [hexifiedUserOp, this.entryPointAddress])
  }

  /**
   * estimate gas requirements for UserOperation
   * @todo change verificationGas to verificationGasLimit when the tests in the bundler are changed
   * @param userOp1
   * @returns latest gas suggestions made by the bundler.
   */
  async estimateUserOpGas (userOp1: Partial<UserOperationStruct>): Promise<{callGasLimit: number, preVerificationGas: number, verificationGas: number}> {
    await this.initializing
    const hexifiedUserOp = deepHexlify(await resolveProperties(userOp1))
    const jsonRequestData: [UserOperationStruct, string] = [hexifiedUserOp, this.entryPointAddress]
    await this.printUserOperation('eth_estimateUserOperationGas', jsonRequestData)
    return await this.userOpJsonRpcProvider
      .send('eth_estimateUserOperationGas', [hexifiedUserOp, this.entryPointAddress])
  }

  private async printUserOperation (method: string, [userOp1, entryPointAddress]: [UserOperationStruct, string]): Promise<void> {
    const userOp = await resolveProperties(userOp1)
    debug('sending', method, {
      ...userOp
      // initCode: (userOp.initCode ?? '').length,
      // callData: (userOp.callData ?? '').length
    }, entryPointAddress)
  }
}
