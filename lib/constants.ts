// アプリ全体で使う言語・科目の定数定義

// 1. 翻訳・学習対象の言語リスト (ユーザー指定の固定リスト)
export const SUPPORTED_LANGUAGES = [
    { code: 'ja', label: '🇯🇵 Japanese', dbName: 'Japanese' },
    { code: 'en', label: '🇬🇧 English', dbName: 'English' },
    { code: 'es', label: '🇪🇸 Spanish', dbName: 'Spanish' },
    { code: 'fr', label: '🇫🇷 French', dbName: 'French' },
    { code: 'zh', label: '🇨🇳 Chinese', dbName: 'Chinese' },
    { code: 'ko', label: '🇰🇷 Korean', dbName: 'Korean' },
    { code: 'pt', label: '🇧🇷 Portuguese', dbName: 'Portuguese' },
    { code: 'ar', label: '🇸🇦 Arabic', dbName: 'Arabic' },
    { code: 'ru', label: '🇷🇺 Russian', dbName: 'Russian' },
    { code: 'de', label: '🇩🇪 German', dbName: 'German' },
    { code: 'it', label: '🇮🇹 Italian', dbName: 'Italian' },
];

// 2. 管理画面などで使う「科目」のリスト
// (言語リストから名前を抽出し、非言語科目を追加)
export const SETUP_SUBJECTS = [
    ...SUPPORTED_LANGUAGES.map(L => L.dbName).filter(name => name !== 'Japanese'), // 学習対象としてJapaneseを除外する場合（母国語なら）
    // ※ もし日本語も学習対象にするなら filter を外してください
    'Programming',
    'Sign Language'
];

// 3. 言語コードから英語名への変換ヘルパー
export const CODE_TO_NAME: Record<string, string> = SUPPORTED_LANGUAGES.reduce((acc, lang) => {
    acc[lang.code] = lang.dbName;
    return acc;
}, {} as Record<string, string>);

// 4. 英語名から言語コードへの変換ヘルパー
export const NAME_TO_CODE: Record<string, string> = SUPPORTED_LANGUAGES.reduce((acc, lang) => {
    acc[lang.dbName] = lang.code;
    return acc;
}, {} as Record<string, string>);