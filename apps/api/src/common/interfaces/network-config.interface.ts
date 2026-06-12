export interface NetworkConfig {
    name: string;
    chainId?: number;
    rpcUrl?: string;
    explorerUrl?: string;
    nativeCurrency: string;
    avgBlockTime: number;
    confirmationsRequired: number;
}
