
const {
    saveRendererSetting,
    loadRendererSettings,
    persistSkinVersion
} = require('../rendererUtils');

describe('rendererUtils Settings', () => {
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

    test('saveRendererSetting saves strings', () => {
        saveRendererSetting(mockStorage, 'testKey', 'testVal');
        expect(mockStorage.setItem).toHaveBeenCalledWith('testKey', 'testVal');
        expect(store['testKey']).toBe('testVal');
    });

    test('saveRendererSetting removes if null', () => {
        store['testKey'] = 'testVal';
        saveRendererSetting(mockStorage, 'testKey', null);
        expect(mockStorage.removeItem).toHaveBeenCalledWith('testKey');
        expect(store['testKey']).toBeUndefined();
    });

    test('loadRendererSettings reads all defaults', () => {
        const settings = loadRendererSettings(mockStorage);
        expect(settings.dpsReportUserToken).toBe('');
        expect(settings.combinerInputDirectory).toBe('d:/gw2logs/output');
        expect(settings.combinerWriteAllJson).toBe(true);
        expect(settings.combinerWriteExcel).toBe(false);
    });

    test('loadRendererSettings reads stored values', () => {
        store['dpsReportUserToken'] = 'token123';
        store['combinerGlickoUpdate'] = 'true';
        store['combinerWriteAllJson'] = 'false';

        const settings = loadRendererSettings(mockStorage);
        expect(settings.dpsReportUserToken).toBe('token123');
        expect(settings.combinerGlickoUpdate).toBe(true);
        expect(settings.combinerWriteAllJson).toBe(false);
    });
});

describe('persistSkinVersion', () => {
    let store;
    let storage;

    beforeEach(() => {
        store = {};
        storage = {
            setItem: jest.fn((k, v) => { store[k] = v; })
        };
    });

    test('stores skinVersion and returns true when skin has a version', () => {
        const result = persistSkinVersion(storage, { version: '1.6.0' });
        expect(result).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith('skinVersion', '1.6.0');
        expect(store.skinVersion).toBe('1.6.0');
    });

    test('returns false and does not write when skin has no version', () => {
        const result = persistSkinVersion(storage, { version: '' });
        expect(result).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    test('returns false when skin is null', () => {
        const result = persistSkinVersion(storage, null);
        expect(result).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});
