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
    it('should return "warn" when log=on', () => {
      global.window = {
        location: {
          search: '?log=on',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'warn');
    });

    it('should return "debug" when log=debug', () => {
      global.window = {
        location: {
          search: '?log=debug',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "info" when log=info', () => {
      global.window = {
        location: {
          search: '?log=info',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'info');
    });

    it('should return "error" when log=error', () => {
      global.window = {
        location: {
          search: '?log=error',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should return "off" when log=off', () => {
      global.window = {
        location: {
          search: '?log=off',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should return custom level when log=custom', () => {
      global.window = {
        location: {
          search: '?log=custom',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'custom');
    });

    it('should work with log parameter among other params', () => {
      global.window = {
        location: {
          search: '?foo=bar&log=debug&baz=qux',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "error" when log= (empty value)', () => {
      global.window = {
        location: {
          search: '?log=',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });
  });

  describe('AEM preview URL-based log level', () => {
    it('should return "warn" for .page domain (AEM preview)', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'warn');
    });

    it('should return "warn" for any subdomain with .page', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'feature-branch--mysite--company.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'warn');
    });

    it('should return "off" for .live domain (production)', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'main--site--org.aem.live',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" for custom production domains', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'www.example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });
  });

  describe('URL parameter override of .page domain', () => {
    it('should allow log=error to override .page domain default', () => {
      global.window = {
        location: {
          search: '?log=error',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'error');
    });

    it('should allow log=off to disable logs on .page domain', () => {
      global.window = {
        location: {
          search: '?log=off',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should allow log=debug to enable debug on production domains', () => {
      global.window = {
        location: {
          search: '?log=debug',
          hostname: 'www.production.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'debug');
    });

    it('should prioritize log parameter over .page domain', () => {
      global.window = {
        location: {
          search: '?log=warn',
          hostname: 'main--site--org.aem.page',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'warn');
    });
  });

  describe('Worker context (URL string parameter)', () => {
    it('should return "warn" when passed .page URL string', () => {
      const urlString = 'https://main--site--org.aem.page/form?test=1';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'warn');
    });

    it('should return "debug" when passed URL with log=debug', () => {
      const urlString = 'https://www.example.com/form?log=debug';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'debug');
    });

    it('should return "warn" when passed URL with log=on', () => {
      const urlString = 'https://www.example.com/form?log=on';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'warn');
    });

    it('should return "info" when passed URL with log=info', () => {
      const urlString = 'https://www.example.com/form?log=info';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'info');
    });

    it('should return "off" when passed production URL', () => {
      const urlString = 'https://www.example.com/form';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" when passed .live URL', () => {
      const urlString = 'https://main--site--org.aem.live/form';
      const logLevel = getLogLevelFromURL(urlString);
      assert.strictEqual(logLevel, 'off');
    });
  });

  describe('Edge cases', () => {
    it('should return "off" when window is undefined', () => {
      global.window = undefined;
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" when window.location is undefined', () => {
      global.window = {};
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" when invalid URL string is passed', () => {
      const logLevel = getLogLevelFromURL('not-a-valid-url');
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" when empty search params on non-.page domain', () => {
      global.window = {
        location: {
          search: '',
          hostname: 'localhost',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });

    it('should return "off" when no log parameter is provided', () => {
      global.window = {
        location: {
          search: '?other=param',
          hostname: 'example.com',
        },
      };
      const logLevel = getLogLevelFromURL();
      assert.strictEqual(logLevel, 'off');
    });
  });
});

