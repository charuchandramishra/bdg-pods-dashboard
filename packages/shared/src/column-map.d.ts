export type BdgField = 'memberName' | 'totalInbound' | 'totalOutbound' | 'apacInbound' | 'apacOutbound' | 'menaInbound' | 'menaOutbound' | 'internationalInbound' | 'internationalOutbound' | 'ukeuInbound' | 'ukeuOutbound' | 'naInbound' | 'naOutbound';
export type PodField = 'podName' | 'description' | 'status' | 'startDate' | 'developers' | 'machineOwner' | 'machineAlignedToProject' | 'feCompletion' | 'beCompletion' | 'integrationCompletion';
export declare function mapBdgHeader(header: string): BdgField | null;
export declare function mapPodHeader(header: string): PodField | null;
export declare function mapHeaders<T extends string>(headers: string[], mapper: (h: string) => T | null): Record<string, T>;
export declare function hasRequiredMappedField(mapping: Record<string, string>, field: string): boolean;
