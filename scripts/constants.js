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