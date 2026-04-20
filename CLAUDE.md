# Working Style & Rules

- User values root-cause fixes, decisive execution, and avoiding repeated passes over the same UI/bug area.
- Prefer identifying the true rendering/ownership layer first, then make one focused fix and verify it.
- **Mobile-first**: user builds mobile app primarily (real iPhone via Xcode + TestFlight, Render-hosted backend). Validate every fix against mobile flow, not desktop assumptions.
- When making any design elements, take into account mobile-first approach with best UI/UX design practices and Apple Human Interface Guidelines.
- All changes, improvements, or new functionality must be created immediately for the different languages available in web and mobile applications, as well as for the interface themes available in web and mobile applications.
- Remember that we have two applications, web and mobile — the mobile one should work as a priority and all changes are tested and applied on it.
- **Debug via logs, never guess**: when a bug isn't immediately obvious from code, add visible diagnostic output FIRST (status codes, per-step logs, banners on screen) and ship that. Only fix once real data shows the failing step. Avoid speculative fixes — they waste deploy cycles and erode trust.
- Diagnostic patterns that worked: visible banner overlay above WebView showing real-time auth status; per-step fetch status logging directly in callback HTML body.
- Always verify state on the server before signaling success to client (e.g. bridge-check after store).
- Reproduce 500/4xx errors with curl directly against the deployed endpoint before assuming code logic is wrong — could be CORS/middleware throwing.
