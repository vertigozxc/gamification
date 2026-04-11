const fs=require('fs');
let s=fs.readFileSync('src/index.js','utf8');
const p = "app.get('/api/analytics/feedback', async (req, res) => {\n    try {\n      const feedbacks = await prisma.questFeedback.findMany({\n        orderBy: { createdAt: 'desc' },\n        take: 100,\n        include: {\n          user: { select: { displayName: true, username: true } }\n        }\n      });";
const rep = "app.get('/api/analytics/feedback', async (req, res) => {\n    try {\n      const feedbacksRaw = await prisma.questFeedback.findMany({\n        orderBy: { createdAt: 'desc' },\n        take: 100\n      });\n      const userIds = [...new Set(feedbacksRaw.map(f => f.userId))];\n      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true }});\n      const userMap = {};\n      users.forEach(u => userMap[u.id] = u);\n      const feedbacks = feedbacksRaw.map(f => ({ ...f, user: userMap[f.userId] || null }));";
s = s.replace(p, rep);
fs.writeFileSync('src/index.js', s);
