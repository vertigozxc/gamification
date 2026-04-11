const fs = require('fs');
let app = fs.readFileSync('../client/src/App.jsx', 'utf8');

// 1. Add imports
if (!app.includes('PostTaskFeedbackModal')) {
  app = app.replace('import TokenVault from "./components/TokenVault";', 
`import TokenVault from "./components/TokenVault";
import PostTaskFeedbackModal from "./components/modals/PostTaskFeedbackModal";
import AnalyticsModal from "./components/modals/AnalyticsModal";
import { submitQuestFeedback } from "./api";`);
}

// 2. Add state inside App component
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
if (!app.includes('feedbackTask')) {
  // Find a good place to put state: near other state declarations.
  app = app.replace('const [nameDraft, setNameDraft] = useState("");', stateCode + '\n  const [nameDraft, setNameDraft] = useState("");');
}

// 3. Update QuestBoard prop
if (app.includes('onCompleteQuest={completeQuest}')) {
  app = app.replace('onCompleteQuest={completeQuest}', 'onCompleteQuest={handleQuestCompleteWrapper}');
}

// 4. Inject Modals
const modalsCode = `
      <PostTaskFeedbackModal
        open={!!feedbackTask}
        quest={feedbackTask}
        onClose={() => setFeedbackTask(null)}
        onSubmit={handleFeedbackSubmit}
      />
      <AnalyticsModal
        open={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
`;
if (!app.includes('<AnalyticsModal')) {
  app = app.replace('<FreezeSuccessModal', modalsCode + '      <FreezeSuccessModal');
}

// 5. Inject Button
const buttonCode = `
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="text-xs px-3 py-1 rounded-full border border-blue-600 bg-blue-900/30 text-blue-500 hover:bg-blue-600 hover:text-white transition-colors font-bold tracking-widest uppercase"
            >
              Analytics
            </button>
`;
if (!app.includes('setIsAnalyticsOpen(true)')) {
  app = app.replace('{t.resetProgress}\n            </button>', '{t.resetProgress}\n            </button>\n' + buttonCode);
}

fs.writeFileSync('../client/src/App.jsx', app);
console.log('App patched');
