// Global test setup for Vitest in jsdom environment

// Mock window.scrollTo
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}

// Polyfill or mock localStorage for headless Linux CI runners
if (typeof window !== 'undefined') {
  try {
    const testKey = '__test_storage__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
  } catch (e) {
    let memoryStore: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => (key in memoryStore ? memoryStore[key] : null),
      setItem: (key: string, value: string) => {
        memoryStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
      clear: () => {
        memoryStore = {};
      },
      key: (i: number) => Object.keys(memoryStore)[i] || null,
      get length() {
        return Object.keys(memoryStore).length;
      },
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
}
