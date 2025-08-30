// scripts/events.js:
export const GameEvents = {
    SHOW_SELECTION_MODAL: 'showSelectionModal',
    SHOW_EXECUTION_MODAL: 'showExecutionModal',
    SHOW_BATTLE_START_MODAL: 'showBattleStartModal',
    SHOW_GAME_OVER_MODAL: 'showGameOverModal',
    ACTION_SELECTED: 'actionSelected',
    PART_BROKEN: 'partBroken', // パーツ破壊を通知するイベント
    // 提案1: 攻撃実行の承認を通知するイベントを追加
    EXECUTION_CONFIRMED: 'executionConfirmed',
};