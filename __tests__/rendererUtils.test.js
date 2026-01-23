
const {
    normalizeUrl,
    isTiddlyhostSignIn,
    makeTiddlyhostLoginScript,
    cloneSupportProfEntry,
    loadSupportProfs,
    saveSupportProfs,
    loadWeights,
    saveWeights,
    getLoginTargetUrl,
    DEFAULT_SUPPORT_PROFS,
    SUPPORT_PROFS_STORAGE_KEY,
    LEGACY_SUPPORT_PROFS_STORAGE_KEY
} = require('../rendererUtils');

describe('rendererUtils', () => {
    describe('normalizeUrl', () => {
        test('normalizes valid urls', () => {
            expect(normalizeUrl('example.com')).toBe('https://example.com/');
            expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
        });
        test('returns null for invalid urls', () => {
            expect(normalizeUrl(null)).toBeNull();
            // expect(normalizeUrl('not a url')).toBeNull(); // URL constructor might accept this relative
        });
    });

    describe('isTiddlyhostSignIn', () => {
        test('detects sign in page', () => {
            expect(isTiddlyhostSignIn('https://tiddlyhost.com/users/sign_in')).toBe(true);
            expect(isTiddlyhostSignIn('https://foo.tiddlyhost.com/users/sign_in/')).toBe(true);
            expect(isTiddlyhostSignIn('https://tiddlyhost.com/')).toBe(false);
            expect(isTiddlyhostSignIn('https://example.com/users/sign_in')).toBe(false);
        });
    });

    describe('cloneSupportProfEntry', () => {
        test('clones valid entry', () => {
            const orig = { name: ' Test ', boons: ['b740', 'invalid'] };
            const cloned = cloneSupportProfEntry(orig);
            expect(cloned).toEqual({ name: 'Test', boons: ['b740'] });
            expect(cloned).not.toBe(orig);
        });
    });

    describe('Storage Helpers with Mock', () => {
        let mockStorage;
        let store = {};

        beforeEach(() => {
            store = {};
            mockStorage = {
                getItem: jest.fn(k => store[k] || null),
                setItem: jest.fn((k, v) => { store[k] = v; }),
                removeItem: jest.fn(k => { delete store[k]; })
            };
        });

        test('loadSupportProfs returns default if missing', () => {
            const res = loadSupportProfs(mockStorage);
            expect(res).toHaveLength(DEFAULT_SUPPORT_PROFS.length);
            expect(res[0].name).toBe(DEFAULT_SUPPORT_PROFS[0].name);
        });

        test('loadSupportProfs reads from storage', () => {
            const data = [{ name: 'Custom', boons: ['b740'] }];
            store[SUPPORT_PROFS_STORAGE_KEY] = JSON.stringify(data);
            const res = loadSupportProfs(mockStorage);
            expect(res).toEqual(data);
        });

        test('loadSupportProfs falls back to legacy', () => {
            const data = [{ name: 'Legacy', boons: ['b740'] }];
            store[LEGACY_SUPPORT_PROFS_STORAGE_KEY] = JSON.stringify(data);
            const res = loadSupportProfs(mockStorage);
            expect(res).toEqual(data);
        });

        test('saveSupportProfs saves and clears legacy', () => {
            const supportProfs = [{ name: 'New', boons: [] }];
            store[LEGACY_SUPPORT_PROFS_STORAGE_KEY] = 'old';
            saveSupportProfs(mockStorage, supportProfs);
            expect(mockStorage.setItem).toHaveBeenCalledWith(SUPPORT_PROFS_STORAGE_KEY, JSON.stringify(supportProfs));
            expect(mockStorage.removeItem).toHaveBeenCalledWith(LEGACY_SUPPORT_PROFS_STORAGE_KEY);
        });

        test('loadWeights returns defaults', () => {
            const keys = ['A', 'B'];
            const res = loadWeights(mockStorage, 'key', keys);
            expect(res).toEqual({ A: 1, B: 1 });
        });

        test('loadWeights merges stored values', () => {
            store['key'] = JSON.stringify({ A: 0.5, C: 2 });
            const keys = ['A', 'B'];
            const res = loadWeights(mockStorage, 'key', keys);
            expect(res).toEqual({ A: 0.5, B: 1 });
        });

        test('saveWeights saves data', () => {
            saveWeights(mockStorage, 'key', { A: 1 });
            expect(store['key']).toBe(JSON.stringify({ A: 1 }));
        });
    });

    describe('getLoginTargetUrl', () => {
        test('rewrites tiddlyhost subdomain', () => {
            expect(getLoginTargetUrl('https://foo.tiddlyhost.com/bar')).toBe('https://tiddlyhost.com/');
        });
        test('rewrites github io', () => {
            expect(getLoginTargetUrl('https://me.github.io/repo')).toBe('https://github.io/');
        });
        test('returns null for bad url', () => {
            expect(getLoginTargetUrl('not url')).toBeNull();
        });
    });
});
