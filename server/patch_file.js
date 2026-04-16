const fs = require('fs');

const path = '/Users/vertigozxc/Documents/gamification/mobile/src/screens/WebAppScreen.js';
let content = fs.readFileSync(path, 'utf8');

const handlerStr = `function buildThemeObserverScript() {
  return \`
    (function() {
      const bridge = window.ReactNativeWebView;
      if (!bridge) return;
      function sendTheme() {
        const computed = getComputedStyle(document.body);
        const b = computed.getPropertyValue('--mobile-tab-bg').trim();
        const a = computed.getPropertyValue('--mobile-tab-active').trim();
        const i = computed.getPropertyValue('--mobile-tab-inactive').trim();
        const o = computed.getPropertyValue('--mobile-tab-orb').trim();
        const ot = computed.getPropertyValue('--mobile-tab-orb-text').trim();
        if (b) {
          bridge.postMessage(JSON.stringify({
            type: 'mobile-theme-update',
            colors: { bg: b, active: a, inactive: i, orb: o, orbText: ot }
          }));
        }
      }
      const observer = new MutationObserver(sendTheme);
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
      window.addEventListener("load", sendTheme);
      setTimeout(sendTheme, 300);
      setTimeout(sendTheme, 1000);
    })();
  \`;
}
`;

content = content.replace('function buildMobileInsetsScript', handlerStr + '\nfunction buildMobileInsetsScript');

const hookStr = `  const [activeTab, setActiveTab] = useState(() => getInitialMobileTab());
  const [theme, setTheme] = useState({ bg: "rgba(8, 15, 30, 0.88)", active: "#fbbf24", inactive: "#94a3b8", orb: "#fbbf24", orbText: "#111827" });`;
content = content.replace('  const [activeTab, setActiveTab] = useState(() => getInitialMobileTab());', hookStr);

const injectStr = `        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(buildMobileTabScript(activeTab));
          webViewRef.current?.injectJavaScript(buildMobileInsetsScript(footerOffsetPx, safeBottomPx, safeTopPx));
          webViewRef.current?.injectJavaScript(buildThemeObserverScript());
        }}`;
content = content.replace(/        onLoadEnd=\{\(\) => \{\s*webViewRef\.current\?\.injectJavaScript\(buildMobileTabScript\(activeTab\)\);\s*webViewRef\.current\?\.injectJavaScript\(buildMobileInsetsScript\(footerOffsetPx, safeBottomPx, safeTopPx\)\);\s*\}\}/g, injectStr);

const handleMsgStr = `  async function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "mobile-theme-update") {
        setTheme(data.colors);
        return;
      }`;
content = content.replace(/  async function handleWebViewMessage\(event\) \{\s*try \{\s*const data = JSON\.parse\(event\.nativeEvent\.data\);/g, handleMsgStr);

// update styles in render
content = content.replace('        <Animated.View\\n            style={[\\n              styles.tabBarWrap', '        <Animated.View style={[styles.tabBarWrap');
content = content.replace(/style=\{\[\s*styles\.tabBarWrap,\s*\{\s*bottom: 0,\s*paddingBottom: Math\.max\(2, insets\.bottom \+ 2\),\s*opacity: tabBarAnim,\s*transform: \[\{ translateY: tabBarAnim\.interpolate\(\{\s*inputRange: \[0, 1\],\s*outputRange: \[26, 0\]\s*\}\) \}\]\s*\}\s*\]\}/g,
"style={[ styles.tabBarWrap, { bottom: 0, paddingBottom: Math.max(2, insets.bottom + 2), opacity: tabBarAnim, transform: [{ translateY: tabBarAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] } ]}");

content = content.replace(/<View style=\{styles\.tabBar\}>/g, "<View style={[styles.tabBar, { backgroundColor: theme.bg }]}>");

// Colors replacement in render
content = content.replace(/<MaterialCommunityIcons name="city-variant" size=\{item\.size\} color=\{isActive \? "#111827" : "#fbbf24"\} \/>/g, '<MaterialCommunityIcons name="city-variant" size={item.size} color={isActive ? theme.orbText : theme.orb} />');

content = content.replace(/<Ionicons name=\{isActive \? item\.icon : item\.iconOutline\} size=\{item\.size\} color=\{isActive \? "#fbbf24" : "#94a3b8"\} \/>/g, '<Ionicons name={isActive ? item.icon : item.iconOutline} size={item.size} color={isActive ? theme.active : theme.inactive} />');

content = content.replace(/<Animated\.View style=\{\[styles\.activePill, \{ opacity: haloOpacity, /g, '<Animated.View style={[styles.activePill, { backgroundColor: theme.active + "22", opacity: haloOpacity, ');

content = content.replace(/backgroundColor: "rgba\\(251, 191, 36, 0\.14\\)",/g, '');


fs.writeFileSync(path, content, 'utf8');
