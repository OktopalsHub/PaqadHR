export interface BulkTransferData {
    amount: number;
    currency: string;
    recipient: string;
    reference: string;
    description?: string;
    bankCode?: string;
    accountNumber?: string;
    network?: string;
    priority?: 'low' | 'medium' | 'high';
}
