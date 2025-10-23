/* eslint-env mocha */
import assert from 'assert';
import { getLogLevelFromURL } from '../../blocks/form/constant.js';

describe('getLogLevelFromURL', () => {
  let originalWindow;

  beforeEach(() => {
    // Save original window object
    originalWindow = global.window;
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;
  });

  describe('URL parameter-based log level', () => {
    it('should return "debug" when afdebug=true is in query string', () => {
      global.window = {
        location: {
          search: '?afdebug=true',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "error" when afdebug=false is explicitly set', () => {
      global.window = {
        location: {
          search: '?afdebug=false',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "debug" when afdebug=true even with other params', () => {
      global.window = {
        location: {
          search: '?foo=bar&afdebug=true&baz=qux',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });
  });

  describe('AEM preview URL-based log level', () => {
    it('should return "debug" for .page domain (AEM preview)', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "debug" for any subdomain with .page', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'feature-branch--mysite--company.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "error" for .live domain (production)', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'main--site--org.aem.live',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" for custom production domains', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'www.example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });
  });

  describe('URL parameter override of .page domain', () => {
    it('should allow afdebug=false to disable debug on .page domain', () => {
      global.window = {
        location: {
          search: '?afdebug=false',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should allow afdebug=true to enable debug on production domains', () => {
      global.window = {
        location: {
          search: '?afdebug=true',
          hostname: 'www.production.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });
  });

  describe('Worker context (URL string parameter)', () => {
    it('should return "debug" when passed .page URL string', () => {
      const urlString = 'https://main--site--org.aem.page/form?test=1';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "debug" when passed URL with afdebug=true', () => {
      const urlString = 'https://www.example.com/form?afdebug=true';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "error" when passed production URL', () => {
      const urlString = 'https://www.example.com/form';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" when passed .live URL', () => {
      const urlString = 'https://main--site--org.aem.live/form';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'error');
    });
  });

  describe('Edge cases', () => {
    it('should return "error" when window is undefined', () => {
      global.window = undefined;
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" when window.location is undefined', () => {
      global.window = {};
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" when invalid URL string is passed', () => {
      const logLevel = getLogLevelFromURL('not-a-valid-url');
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" when empty search params on non-.page domain', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'localhost',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "error" when afdebug has invalid value', () => {
      global.window = {
        location: {
          search: '?afdebug=invalid',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });
  });
});

