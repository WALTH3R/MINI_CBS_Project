// jsdom (the test environment) doesn't implement matchMedia — real browsers all do, so this is
// a test-environment gap, not an app bug. ThemeService calls it on construction.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
