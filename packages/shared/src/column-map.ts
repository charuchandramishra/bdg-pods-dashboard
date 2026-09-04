import { normalizeHeader } from './normalize';

export type BdgField =
  | 'memberName'
  | 'totalInbound'
  | 'totalOutbound'
  | 'apacInbound'
  | 'apacOutbound'
  | 'menaInbound'
  | 'menaOutbound'
  | 'internationalInbound'
  | 'internationalOutbound'
  | 'ukeuInbound'
  | 'ukeuOutbound'
  | 'naInbound'
  | 'naOutbound';

export type PodField =
  | 'podName'
  | 'description'
  | 'status'
  | 'startDate'
  | 'developers'
  | 'machineOwner'
  | 'machineAlignedToProject'
  | 'feCompletion'
  | 'beCompletion'
  | 'integrationCompletion';

const BDG_ALIASES: Record<BdgField, string[]> = {
  memberName: [
    'bdg member',
    'bdg member name',
    'member',
    'member name',
    'name',
  ],
  totalInbound: [
    'total leads inbound',
    'total inbound',
    'inbound',
    'total leads in bound',
  ],
  totalOutbound: [
    'total leads outbound',
    'total outbound',
    'outbound',
    'total leads out bound',
  ],
  apacInbound: ['apac inbound', 'apac in'],
  apacOutbound: ['apac outbound', 'apac out'],
  menaInbound: ['mena inbound', 'mena in'],
  menaOutbound: ['mena outbound', 'mena out'],
  internationalInbound: [
    'international inbound',
    'intl inbound',
    'international in',
  ],
  internationalOutbound: [
    'international outbound',
    'intl outbound',
    'international out',
  ],
  ukeuInbound: ['uk eu inbound', 'uk/eu inbound', 'ukeu inbound', 'uk inbound'],
  ukeuOutbound: [
    'uk eu outbound',
    'uk/eu outbound',
    'ukeu outbound',
    'uk outbound',
  ],
  naInbound: ['na inbound', 'north america inbound', 'n a inbound'],
  naOutbound: ['na outbound', 'north america outbound', 'n a outbound'],
};

const POD_ALIASES: Record<PodField, string[]> = {
  podName: ['pod name', 'pod', 'pod_name', 'name'],
  description: ['description', 'desc'],
  status: ['status'],
  startDate: ['start date', 'startdate', 'start'],
  developers: ['dev', 'developer', 'developers', 'devs'],
  machineOwner: ['machine owner', 'owner'],
  machineAlignedToProject: [
    'machine aligned to project',
    'machine',
    'machine aligned',
  ],
  feCompletion: ['fe', 'frontend', 'front end', 'fe completion', 'fe %'],
  beCompletion: ['be', 'backend', 'back end', 'be completion', 'be %'],
  integrationCompletion: [
    'fe be integrations',
    'fe + be integrations',
    'integration',
    'integrations',
    'fe be integration',
    'integration completion',
  ],
};

function buildLookup(
  aliases: Record<string, string[]>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [field, list] of Object.entries(aliases)) {
    for (const alias of list) {
      map.set(normalizeHeader(alias), field);
    }
  }
  return map;
}

const BDG_LOOKUP = buildLookup(BDG_ALIASES);
const POD_LOOKUP = buildLookup(POD_ALIASES);

export function mapBdgHeader(header: string): BdgField | null {
  const key = normalizeHeader(header);
  return (BDG_LOOKUP.get(key) as BdgField | undefined) ?? null;
}

export function mapPodHeader(header: string): PodField | null {
  const key = normalizeHeader(header);
  return (POD_LOOKUP.get(key) as PodField | undefined) ?? null;
}

export function mapHeaders<T extends string>(
  headers: string[],
  mapper: (h: string) => T | null,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const header of headers) {
    const field = mapper(header);
    if (field) {
      result[header] = field;
    }
  }
  return result;
}

export function hasRequiredMappedField(
  mapping: Record<string, string>,
  field: string,
): boolean {
  return Object.values(mapping).includes(field);
}
