export type Subtitle = {
    text: string;
    translation?: string;
    offset: number;
    duration: number;
    translations: { [key: string]: string };
};

export type DictionaryData = {
    word: string;
    phonetic?: string;
    audio?: string;
    translation?: string;
    sourceLang?: string;
    meanings?: { partOfSpeech: string; definitions: { definition: string }[]; }[];
};

export type UserLevelData = {
    user_id: string;
    subject: string;
    level_result: string;
    score: number;
    xp: number;
};

export type UserProfile = {
    id: string;
    level: number;
    xp: number;
    next_level_xp: number;
    theme: 'kids' | 'student' | 'pro';
    goal: string;
    placement_test_done: boolean;
    learning_target: string;
    study_guide_langs: string[];
};
