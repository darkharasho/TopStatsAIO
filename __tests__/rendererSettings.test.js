
const {
    saveRendererSetting,
    loadRendererSettings
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
