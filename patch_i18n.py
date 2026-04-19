import re

with open("client/src/i18nConfig.js", "r", encoding="utf-8") as f:
    content = f.read()

# I will replace some obvious RPG words:
replacements = [
    # English
    (r'"Initializing world\.\.\."', r'"Initializing workspace..."'),
    (r'"Turn Your Life into an Epic Adventure"', r'"Build Discipline & Track Habits"'),
    (r'"Watch your personal digital realm transform from an empty plot to a thriving metropolis as you reach higher levels\."', r'"Watch your progress transform from a simple start into a thriving habit ecosystem as you reach higher levels."'),
    (r'"Your city expands its borders! New structures emerge and new lights ignite across the districts as your power grows\."', r'"Your workspace expands! New elements emerge as you build better habits."'),
    (r'"Quest Conquered!"', r'"Quest Completed!"'),
    (r'"⚔️ Event Log"', r'"📋 Activity Log"'),
    (r'"🪙 Token Vault"', r'"🪙 Reward Vault"'),
    (r'milestoneRunes: \[.*?\]', r'milestoneRunes: ["✓", "★", "🏆"]'),
    (r'"Character portrait updated!"', r'"Profile image updated!"'),
    (r'"Character name changed to "', r'"Profile name changed to "'),

    # Russian RPG terms
    (r'"Инициализация мира\.\.\."', r'"Инициализация приложения..."'),
    (r'"Войти в мир"', r'"Войти"'),
    (r'"Перед началом пути войдите через Google-аккаунт\."', r'"Войдите через Google, чтобы начать работу с Habits."'),
    (r'"Покинуть приключение\?"', r'"Выйти из приложения?"'),
    (r'"В мире пока нет героев\.\.\."', r'"Здесь пока никого нет..."'),
    (r'"⚔️ Журнал событий"', r'"📋 Журнал активности"'),
    (r'"Новая победа"', r'"Новое достижение"'),
    (r'"Ваша сила растет, и мир это замечает\."', r'"Ваш прогресс увеличивается!"'),
    (r'"С возвращением\. Ваш путь продолжается\.\.\."', r'"С возвращением! Продолжайте выполнять свои Habits."'),
    (r'"Преврати свою жизнь в эпическое приключение"', r'"Развивай дисциплину и отслеживай привычки"'),
    (r'"Наблюдайте, как ваше личное цифровое королевство превращается из пустого участка в процветающий мегаполис по мере роста уровня\."', r'"Наблюдайте за своим прогрессом по мере регулярного выполнения Habits."'),
    (r'"Ваш город расширяет границы! Появляются новые здания и загораются новые огни, пока растет ваша сила\."', r'"Вы достигли нового прогресса! Продолжайте в том же духе."'),
    (r'"Первая настройка"', r'"Добро пожаловать"'),
    (r'"Выберите никнейм и 3 привычки\.', r'"Выберите никнейм и 3 Habits.'),
    (r'"Введите имя героя"', r'"Введите ваш никнейм"'),
    (r'"Начать приключение"', r'"Начать"'),
    (r'"Задание покорено!"', r'"Привычка выполнена!"'),
    (r'"Портрет персонажа обновлен!"', r'"Фото профиля обновлено!"'),
    (r'"Имя персонажа изменено на "', r'"Имя профиля изменено на "'),
    
    # Keeping Quests, Habits, XP, streak, Level. Do not change them.
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open("client/src/i18nConfig.js", "w", encoding="utf-8") as f:
    f.write(content)

