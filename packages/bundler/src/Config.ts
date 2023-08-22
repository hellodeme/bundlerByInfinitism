import ow from "ow";
import fs from "fs";

import {
  BundlerConfig,
  bundlerConfigDefault,
  BundlerConfigShape,
} from "./BundlerConfig";
import { Wallet, ethers } from "ethers";
import { BaseProvider, JsonRpcProvider } from "@ethersproject/providers";

function getCommandLineParams(programOpts: any): Partial<BundlerConfig> {
  const params: any = {};
  for (const bundlerConfigShapeKey in BundlerConfigShape) {
    const optionValue = programOpts[bundlerConfigShapeKey];
    if (optionValue != null) {
      params[bundlerConfigShapeKey] = optionValue;
    }
  }
  return params as BundlerConfig;
}

const mnemonicToPrivateKey = (mnemonic: string) => {
  const path = "m/44'/60'/0'/0/0"; // BIP44 standard path for Ethereum

  // Create a wallet instance from the mnemonic
  const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);

  // Get the private key
  const privateKey = wallet.privateKey;

  return privateKey;
};

function mergeConfigs(
  ...sources: Array<Partial<BundlerConfig>>
): BundlerConfig {
  const mergedConfig = Object.assign({}, ...sources);
  ow(mergedConfig, ow.object.exactShape(BundlerConfigShape));
  return mergedConfig;
}

const DEFAULT_INFURA_ID = "d442d82a1ab34327a7126a578428dfc4";

export function getNetworkProvider(url: string): JsonRpcProvider {
  if (url.match(/^[\w-]+$/) != null) {
    const infuraId = process.env.INFURA_ID1 ?? DEFAULT_INFURA_ID;
    url = `https://ethereum-goerli.publicnode.com`;
  }
  console.log("url=", url);
  return new JsonRpcProvider(url);
}

export async function resolveConfiguration(
  programOpts: any
): Promise<{ config: BundlerConfig; provider: BaseProvider; wallet: Wallet }> {
  const commandLineParams = getCommandLineParams(programOpts);
  let fileConfig: Partial<BundlerConfig> = {};
  const configFileName = programOpts.config;
  if (fs.existsSync(configFileName)) {
    fileConfig = JSON.parse(fs.readFileSync(configFileName, "ascii"));
  }
  const config = mergeConfigs(
    bundlerConfigDefault,
    fileConfig,
    commandLineParams
  );
  console.log("Merged configuration:", JSON.stringify(config));

  const provider: BaseProvider =
    config.network === "hardhat"
      ? // eslint-disable-next-line
        require("hardhat").ethers.provider
      : getNetworkProvider(config.network);

  let mnemonic: string;
  let wallet: Wallet;
  try {
    mnemonic = fs.readFileSync(config.mnemonic, "ascii").trim();
    console.log("mnemonic", mnemonic);
    const privateKey = mnemonicToPrivateKey(mnemonic);
    console.log("private key", privateKey);
    wallet = Wallet.fromMnemonic(mnemonic).connect(provider);
  } catch (e: any) {
    throw new Error(
      `Unable to read --mnemonic ${config.mnemonic}: ${e.message as string}`
    );
  }
  return { config, provider, wallet };
}
