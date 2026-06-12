export interface StandardErrorResponse {
    statusCode: number;
    error: string;
    message: string | string[];
    timestamp: string;
    path: string;
    traceId: string;
    errors?: Record<string, string[]>;
    code?: string;
    context?: Record<string, any>;
}
