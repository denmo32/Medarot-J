/**
 * @file 戦闘シーン固有の定数定義
 * @description ゲーム全体の定数は `scripts/common/constants.js` に定義し、
 * ここでは戦闘シーン特有の状態定義などを定義します。
 */

/**
 * ゲーム全体の状態（フェーズ）を定義する定数
 */
export const BattlePhase = {
    IDLE: 'IDLE',
    BATTLE_START: 'BATTLE_START',
    INITIAL_SELECTION: 'INITIAL_SELECTION',
    TURN_START: 'TURN_START',
    ACTION_SELECTION: 'ACTION_SELECTION',
    ACTION_EXECUTION: 'ACTION_EXECUTION',
    TURN_END: 'TURN_END',
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
    AWAITING_ANIMATION: 'awaiting_animation',
    COOLDOWN_COMPLETE: 'cooldown_complete',
    BROKEN: 'broken',
    GUARDING: 'guarding',
};

/**
 * モーダルの種類を定義する定数
 */
export const ModalType = {
    START_CONFIRM: 'start_confirm',
    SELECTION: 'selection',
    ATTACK_DECLARATION: 'attack_declaration',
    EXECUTION_RESULT: 'execution_result',
    BATTLE_START_CONFIRM: 'battle_start_confirm',
    GAME_OVER: 'game_over',
    MESSAGE: 'message'
};

/**
 * アクションキャンセルの理由を定義する定数
 */
export const ActionCancelReason = {
    PART_BROKEN: 'PART_BROKEN',
    TARGET_LOST: 'TARGET_LOST',
    INTERRUPTED: 'INTERRUPTED',
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
    CONSUME_GUARD: 'CONSUME_GUARD',
    APPLY_STUN: 'APPLY_STUN', 
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
    撃つ: '撃つ',
    狙い撃ち: '狙い撃ち',
    殴る: '殴る',
    我武者羅: '我武者羅',
    支援: '支援',
    修復: '修復',
    妨害: '妨害',
    守る: '守る',
};

/**
 * ターゲット決定タイミングを定義する定数
 */
export const TargetTiming = {
    PRE_MOVE: 'pre-move',   // 移動前にターゲットを決定する
    POST_MOVE: 'post-move'  // 移動後にターゲットを決定する
};

/**
 * 戦闘ログの種類を定義する定数（リファクタリング用）
 */
export const BattleLogType = {
    DECLARATION: 'DECLARATION',
    GUARDIAN_TRIGGER: 'GUARDIAN_TRIGGER',
    ANIMATION_START: 'ANIMATION_START',
    EFFECT: 'EFFECT',
    MISS: 'MISS',
};