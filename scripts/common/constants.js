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
 * カスタマイズ画面の装備スロットタイプを定義する定数
 */
export const EquipSlotType = {
    ...PartType,
    MEDAL: 'medal'
};

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

/**
 * アクションの効果種別を定義する定数
 */
export const EffectType = {
    DAMAGE: 'DAMAGE',
    APPLY_SCAN: 'APPLY_SCAN',
    HEAL: 'HEAL',
    APPLY_GLITCH: 'APPLY_GLITCH',
    APPLY_GUARD: 'APPLY_GUARD',
};

/**
 * アクションの効果範囲を定義する定数
 */
export const EffectScope = {
    ENEMY_SINGLE: 'ENEMY_SINGLE',
    ALLY_SINGLE: 'ALLY_SINGLE',
    ALLY_TEAM: 'ALLY_TEAM',
    SELF: 'SELF',
};

/**
 * アクションの論理的な分類を定義する定数
 */
export const ActionType = {
    SHOOT: 'SHOOT',
    MELEE: 'MELEE',
    HEAL: 'HEAL',
    SUPPORT: 'SUPPORT',
    INTERRUPT: 'INTERRUPT',
    DEFEND: 'DEFEND',
};

/**
 * 攻撃の特性（タイプ）を定義する定数
 */
export const AttackType = {
    SHOOT: '撃つ',
    AIMED_SHOT: '狙い撃ち',
    STRIKE: '殴る',
    RECKLESS: '我武者羅',
    SUPPORT: '支援',
    REPAIR: '修復',
    INTERRUPT: '妨害',
    DEFEND: '守る',
};

/**
 * ターゲット決定タイミングを定義する定数
 */
export const TargetTiming = {
    PRE_MOVE: 'pre-move',   // 移動前にターゲットを決定する
    POST_MOVE: 'post-move'  // 移動後にターゲットを決定する
};