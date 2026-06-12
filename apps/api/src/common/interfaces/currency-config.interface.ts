export interface CurrencyConfig {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    type: 'fiat' | 'crypto';
    network?: string;
    contractAddress?: string;
    minAmount?: number;
    maxAmount?: number;
    isActive: boolean;
}
