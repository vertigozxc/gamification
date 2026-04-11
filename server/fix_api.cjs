const fs = require('fs');
let content = fs.readFileSync('../client/src/api.js', 'utf8');
const newApi = `
export function submitQuestFeedback(username, questId, rating, textNotes, questionType = 'How useful was this task?') {
  return request('/api/quest-feedback', {
    method: 'POST',
    body: JSON.stringify({ username, questId, rating, textNotes, questionType })
  });
}

export function fetchQuestFeedbackAnalytics() {
  return request('/api/analytics/feedback');
}
`;
if (!content.includes('submitQuestFeedback')) {
  fs.writeFileSync('../client/src/api.js', content + '\n' + newApi);
  console.log('Added to api.js');
}
