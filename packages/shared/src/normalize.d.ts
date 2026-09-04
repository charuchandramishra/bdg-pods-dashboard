export declare function normalizeKey(value: string): string;
export declare function isAggregateMemberName(value: string): boolean;
export declare function normalizeHeader(value: string): string;
export declare function normalizePercentage(value: unknown): number | null;
export declare function parseNullableNumber(value: unknown): number | null;
export declare function excelSerialToIsoDate(serial: number): string;
export declare function parseFlexibleDate(value: unknown): string | null;
export declare function overallCompletion(fe: number | null | undefined, be: number | null | undefined, integration: number | null | undefined): number | null;
