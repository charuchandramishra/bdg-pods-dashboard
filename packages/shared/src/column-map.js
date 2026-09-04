"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBdgHeader = mapBdgHeader;
exports.mapPodHeader = mapPodHeader;
exports.mapHeaders = mapHeaders;
exports.hasRequiredMappedField = hasRequiredMappedField;
const normalize_1 = require("./normalize");
const BDG_ALIASES = {
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
const POD_ALIASES = {
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
function buildLookup(aliases) {
    const map = new Map();
    for (const [field, list] of Object.entries(aliases)) {
        for (const alias of list) {
            map.set((0, normalize_1.normalizeHeader)(alias), field);
        }
    }
    return map;
}
const BDG_LOOKUP = buildLookup(BDG_ALIASES);
const POD_LOOKUP = buildLookup(POD_ALIASES);
function mapBdgHeader(header) {
    const key = (0, normalize_1.normalizeHeader)(header);
    return BDG_LOOKUP.get(key) ?? null;
}
function mapPodHeader(header) {
    const key = (0, normalize_1.normalizeHeader)(header);
    return POD_LOOKUP.get(key) ?? null;
}
function mapHeaders(headers, mapper) {
    const result = {};
    for (const header of headers) {
        const field = mapper(header);
        if (field) {
            result[header] = field;
        }
    }
    return result;
}
function hasRequiredMappedField(mapping, field) {
    return Object.values(mapping).includes(field);
}
//# sourceMappingURL=column-map.js.map