function buildWebMessageHandler() {
  return `
    (function() {
      const bridge = window.ReactNativeWebView;
      if (!bridge) return;
      function sendTheme() {
        const computed = getComputedStyle(document.body);
        const bg = computed.getPropertyValue('--mobile-tab-bg').trim();
        const active = computed.getPropertyValue('--mobile-tab-active').trim();
        const inactive = computed.getPropertyValue('--mobile-tab-inactive').trim();
        const orb = computed.getPropertyValue('--mobile-tab-orb').trim();
        const orbText = computed.getPropertyValue('--mobile-tab-orb-text').trim();
        
        if (bg && active) {
          try {
            bridge.postMessage(JSON.stringify({
              type: 'mobile-theme-update',
              colors: { bg, active, inactive, orb, orbText }
            }));
          } catch (e) { /* webkit messageHandlers can be undefined during teardown */ }
        }
      }
      
      const observer = new MutationObserver(sendTheme);
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
      window.addEventListener("load", sendTheme);
      setTimeout(sendTheme, 300);
      setTimeout(sendTheme, 1000);
    })();
  `;
}
