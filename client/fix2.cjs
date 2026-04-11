const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const stateCode = `
  const [feedbackTask, setFeedbackTask] = useState(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const handleQuestCompleteWrapper = (quest, event) => {
    completeQuest(quest, event);
    setFeedbackTask(quest);
  };

  const handleFeedbackSubmit = (feedbackData) => {
    if (feedbackTask && authUser) {
      submitQuestFeedback(authUser.uid, feedbackTask.id, feedbackData.rating, feedbackData.textNotes, feedbackData.questionType).catch(console.error);
    }
    setFeedbackTask(null);
  };
`;

if (!app.includes('const [feedbackTask')) {
  app = app.replace('const [nameDraft, setNameDraft] = useState("Warrior");', stateCode + '\n  const [nameDraft, setNameDraft] = useState("Warrior");');
  fs.writeFileSync('src/App.jsx', app);
  console.log('Fixed state code injection');
} else {
  console.log('State code already present');
}
