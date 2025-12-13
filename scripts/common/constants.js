/**
 * @file ゲーム全体で共有される定数定義
 * @description 戦闘、マップ、カスタマイズなど、シーンを跨いで使用される基本的な列挙型や定数を定義します。
 */

/**
 * パーツの部位に関する情報を一元管理する定数
 */
export const PartInfo = {
    HEAD:      { key: 'head',     name: '頭部', icon: '👤' },
    RIGHT_ARM: { key: 'rightArm', name: '右腕', icon: '🫷' },
    LEFT_ARM:  { key: 'leftArm',  name: '左腕', icon: '🫸' },
    LEGS:      { key: 'legs',     name: '脚部', icon: '👣' }
};

/**
 * パーツのキーを定義する定数
 */
export const PartType = Object.values(PartInfo).reduce((acc, { key }) => {
    const keyName = Object.keys(PartInfo).find(k => PartInfo[k].key === key);
    if (keyName) {
        acc[keyName] = key;
    }
    return acc;
}, {});

/**
 * パーツキーから対応するPartInfoオブジェクトを逆引きするためのマップ
 */
export const PartKeyToInfoMap = Object.values(PartInfo).reduce((acc, info) => {
    acc[info.key] = info;
    return acc;
}, {});

/**
 * チームIDを定義する定数
 */
export const TeamID = {
    TEAM1: 'team1',
    TEAM2: 'team2'
};

/**
 * メダルの性格タイプを定義する定数
 */
export const MedalPersonality = {
    LEADER_FOCUS: 'LEADER_FOCUS',
    RANDOM: 'RANDOM',
    HUNTER: 'HUNTER',
    CRUSHER: 'CRUSHER',
    SPEED: 'SPEED',
    JOKER: 'JOKER',
    COUNTER: 'COUNTER',
    GUARD: 'GUARD',
    FOCUS: 'FOCUS',
    ASSIST: 'ASSIST',
    HEALER: 'HEALER',
};