/**
 * Prompt default resource loader
 * - Loads prompts/<lang>.json
 * - Provides sync lookup from in-memory cache
 */

const _cache = new Map(); // lang -> prompts object | null
let _basePath = '';

function _normalizeLf(text) {
    return typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : text;
}

function _normalizePromptsObject(rawPrompts) {
    if (!rawPrompts || typeof rawPrompts !== 'object') return null;
    const out = {};
    for (const [k, v] of Object.entries(rawPrompts)) {
        if (typeof v === 'string') out[k] = _normalizeLf(v);
    }
    return out;
}

function _normalizeLang(raw) {
    if (!raw) return 'en';
    const lower = String(raw).toLowerCase().replace(/_/g, '-');
    if (lower === 'zh-cn' || lower === 'zh-hans' || lower === 'zh-sg') return 'zh-CN';
    if (lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk' || lower === 'zh-mo') return 'zh-TW';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('ru')) return 'ru';
    if (lower === 'zh') return 'zh-CN';
    return 'en';
}

function _candidateLangs(lang) {
    const n = _normalizeLang(lang);
    // Only use close locale fallback here.
    // Hardcoded defaults in callers remain the final fallback, so we must not
    // force unrelated languages (e.g. English) to consume zh-CN prompt assets.
    if (n === 'zh-TW') return ['zh-TW', 'zh-CN'];
    return [n];
}

async function _loadLang(lang) {
    if (!lang) return null;
    if (_cache.has(lang)) return _cache.get(lang);
    if (!_basePath) return null;
    try {
        const url = `${_basePath}/prompts/${lang}.json`;
        const resp = await fetch(url);
        if (!resp.ok) {
            _cache.set(lang, null);
            return null;
        }
        const data = await resp.json();
        const prompts = (data && typeof data === 'object' && data.prompts && typeof data.prompts === 'object')
            ? _normalizePromptsObject(data.prompts)
            : null;
        _cache.set(lang, prompts);
        return prompts;
    } catch {
        _cache.set(lang, null);
        return null;
    }
}

export async function initPromptDefaults(basePath, preferredLang = 'en') {
    _basePath = String(basePath || '').replace(/\/+$/, '');
    await ensurePromptDefaults(preferredLang);
}

export async function ensurePromptDefaults(lang) {
    const candidates = _candidateLangs(lang);
    for (const c of candidates) {
        await _loadLang(c);
    }
}

export function getPromptDefaultSync(lang, key) {
    if (!key) return '';
    const candidates = _candidateLangs(lang);
    for (const c of candidates) {
        const prompts = _cache.get(c);
        if (!prompts || typeof prompts !== 'object') continue;
        const val = prompts[key];
        if (typeof val === 'string' && val.length > 0) return _normalizeLf(val);
    }
    return '';
}
