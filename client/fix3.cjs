const fs = require('fs');
let app = fs.readFileSync('../client/src/App.jsx', 'utf8');

app = app.replace(/dayMarkerRef\.current = .*;/g, 'dayMarkerRef.current = String(new Date().getUTCFullYear()) + "-" + String(new Date().getUTCMonth()) + "-" + String(new Date().getUTCDate());');

fs.writeFileSync('../client/src/App.jsx', app);
