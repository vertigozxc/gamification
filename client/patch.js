const fs = require('fs');
const file = '../client/src/components/modals/AnalyticsModal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('{data.stats && data.stats.length > 0 ? (', '{Array.isArray(data?.stats) && data.stats.length > 0 ? (');
content = content.replace('{data.stats.map(stat => (', '{data.stats.map((stat, idx) => (');
content = content.replace('key={stat.questId + stat.questionType}', 'key={String(stat?.questId) + String(stat?.questionType) + idx}');
content = content.replace('<div className=\"text-[10px] uppercase opacity-70 truncate mb-1\" title={stat.questId}>{stat.questId}</div>', '<div className=\"text-[10px] uppercase opacity-70 truncate mb-1\" title={stat?.questId || \"Unknown\"}>{stat?.questId || \"Unknown\"}</div>');
content = content.replace('{stat._avg?.rating?.toFixed(1) || \"-\"}', '{typeof stat?._avg?.rating === \"number\" ? stat._avg.rating.toFixed(1) : \"-\"}');
content = content.replace(/{stat\._count\?\.rating\} logs .*?\{\(stat\.questionType/g, '{stat?._count?.rating || 0} logs \u00B7 {String(stat?.questionType');

content = content.replace('{data.feedbacks && data.feedbacks.length > 0 ? (', '{Array.isArray(data?.feedbacks) && data.feedbacks.length > 0 ? (');
content = content.replace('key={f.id || i}', 'key={f?.id || i}');
content = content.replace('{f.rating}', '{f?.rating || 0}');
content = content.replace('<span className=\"text-sm font-bold uppercase tracking-wider\">{f.questId}</span>', '<span className=\"text-sm font-bold uppercase tracking-wider\">{f?.questId || \"Unknown\"}</span>');
content = content.replace('By {f.user?.displayName || f.user?.username || \"Unknown\"}', 'By {f?.user?.displayName || f?.user?.username || \"Unknown\"}');
content = content.replace('{new Date(f.createdAt).toLocaleDateString(undefined, { month: \\'short\\', day: \\'numeric\\', hour: \\'2-digit\\', minute: \\'2-digit\\' })}', '{f?.createdAt ? new Date(f.createdAt).toLocaleDateString(undefined, { month: \\'short\\', day: \\'numeric\\', hour: \\'2-digit\\', minute: \\'2-digit\\' }) : \"Date Unknown\"}');
content = content.replace('{f.textNotes && (', '{f?.textNotes && (');
content = content.replace('\"{f.textNotes}\"', '\"{f?.textNotes}\"');

fs.writeFileSync(file, content);
console.log('Fixed analytics data mapping issues!');
