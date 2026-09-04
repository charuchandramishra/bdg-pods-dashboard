"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeKey = normalizeKey;
exports.isAggregateMemberName = isAggregateMemberName;
exports.normalizeHeader = normalizeHeader;
exports.normalizePercentage = normalizePercentage;
exports.parseNullableNumber = parseNullableNumber;
exports.excelSerialToIsoDate = excelSerialToIsoDate;
exports.parseFlexibleDate = parseFlexibleDate;
exports.overallCompletion = overallCompletion;
function normalizeKey(value) {
    return value
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
function isAggregateMemberName(value) {
    const key = normalizeKey(value);
    if (!key)
        return false;
    return (key === 'total' ||
        key === 'totals' ||
        key === 'grand total' ||
        key === 'grand totals' ||
        key === 'sum' ||
        key === 'overall' ||
        key === 'all' ||
        key.startsWith('total ') ||
        key.endsWith(' total'));
}
function normalizeHeader(value) {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[%()]/g, ' ')
        .replace(/[_\-/\\]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizePercentage(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const hasPercent = trimmed.includes('%');
        const numeric = Number(trimmed.replace(/%/g, '').replace(/,/g, '').trim());
        if (Number.isNaN(numeric))
            return null;
        if (hasPercent)
            return clampPercent(numeric);
        if (numeric >= 0 && numeric <= 1)
            return clampPercent(numeric * 100);
        return clampPercent(numeric);
    }
    if (typeof value === 'number') {
        if (Number.isNaN(value))
            return null;
        if (value >= 0 && value <= 1)
            return clampPercent(value * 100);
        return clampPercent(value);
    }
    return null;
}
function clampPercent(n) {
    if (n < 0)
        return 0;
    if (n > 100)
        return 100;
    return Math.round(n * 100) / 100;
}
function parseNullableNumber(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned)
            return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function excelSerialToIsoDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().slice(0, 10);
}
function parseFlexibleDate(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number' && value > 20000 && value < 80000) {
        return excelSerialToIsoDate(value);
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
        if (dmy) {
            const day = Number(dmy[1]);
            const month = Number(dmy[2]);
            const year = Number(dmy[3]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
        const iso = Date.parse(trimmed);
        if (!Number.isNaN(iso)) {
            return new Date(iso).toISOString().slice(0, 10);
        }
    }
    return null;
}
function overallCompletion(fe, be, integration) {
    const values = [fe, be, integration].filter((v) => typeof v === 'number' && !Number.isNaN(v));
    if (values.length === 0)
        return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}
//# sourceMappingURL=normalize.js.map