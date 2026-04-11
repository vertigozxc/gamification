const fs = require('fs');
let content = fs.readFileSync('src/index.js', 'utf8');

const routeCode = `
app.post('/api/quest-feedback', async (req, res) => {
  try {
    const { username, questId, rating, textNotes, questionType } = req.body;
    
    if (!username || !questId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const feedback = await prisma.questFeedback.create({
      data: {
        userId: user.id,
        questId: String(questId),
        rating: Number(rating) || 0,
        textNotes: textNotes || null,
        questionType: questionType || 'How useful was this task?'
      }
    });

    return res.json({ success: true, feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analytics/feedback', async (req, res) => {
  try {
    const feedbacks = await prisma.questFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { displayName: true, username: true } }
      }
    });
    
    const stats = await prisma.questFeedback.groupBy({
      by: ['questId', 'questionType'],
      _avg: { rating: true },
      _count: { rating: true }
    });

    return res.json({ feedbacks, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

`;

if (!content.includes('/api/quest-feedback') && content.includes('app.listen(')) {
  content = content.replace('app.listen(', routeCode + '\napp.listen(');
  fs.writeFileSync('src/index.js', content);
  console.log('Routes added near app.listen');
} else {
  console.log('Routes already present or app.listen not found');
}
