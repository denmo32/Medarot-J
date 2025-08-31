// scripts/constants.js:

/**
 * ゲーム全体の状態を定義する定数
 */
export const GamePhaseType = {
    IDLE: 'IDLE',
    INITIAL_SELECTION: 'INITIAL_SELECTION',
    BATTLE_START_CONFIRM: 'BATTLE_START_CONFIRM',
    BATTLE: 'BATTLE',
    GAME_OVER: 'GAME_OVER'
};

/**
 * 各プレイヤーの状態を定義する定数
 */
export const PlayerStateType = {
    CHARGING: 'charging',
    READY_SELECT: 'ready_select',
    SELECTED_CHARGING: 'selected_charging',
    READY_EXECUTE: 'ready_execute',
    COOLDOWN_COMPLETE: 'cooldown_complete',
    BROKEN: 'broken'
};

/**
 * パーツのキーを定義する定数
 */
export const PartType = {
    HEAD: 'head',
    RIGHT_ARM: 'rightArm',
    LEFT_ARM: 'leftArm',
    LEGS: 'legs'
};

/**
 * チームIDを定義する定数
 */
export const TeamID = {
    TEAM1: 'team1',
    TEAM2: 'team2'
};

/**
 * メダルの性格タイプを定義する定数
 * これに基づいてターゲット選択のAIが分岐する
 */
export const MedalPersonality = {
    LEADER_FOCUS: 'LEADER_FOCUS', // 常にリーダーを狙う
    RANDOM: 'RANDOM',             // ターゲットをランダムに選択する
    HUNTER: 'HUNTER',             // 最も装甲が低いパーツを狙う
    CRUSHER: 'CRUSHER',           // 最も装甲が高いパーツを狙う
    JOKER: 'JOKER',               // 敵の全パーツからランダムに選択
    COUNTER: 'COUNTER',           // 自分を最後に攻撃してきた敵に反撃
    GUARD: 'GUARD',               // 味方リーダーを最後に攻撃してきた敵を狙う
    FOCUS: 'FOCUS',               // 前回攻撃したパーツを集中攻撃
    ASSIST: 'ASSIST',             // 味方が最後に攻撃した敵のパーツを狙う
};

/**
 * ★新規: モーダルの種類を定義する定数
 * これにより、コード内のマジックストリングを排除し、タイプミスによるバグを防ぎます。
 */
export const ModalType = {
    START_CONFIRM: 'start_confirm',
    SELECTION: 'selection',
    EXECUTION: 'execution',
    BATTLE_START_CONFIRM: 'battle_start_confirm',
    GAME_OVER: 'game_over'
};