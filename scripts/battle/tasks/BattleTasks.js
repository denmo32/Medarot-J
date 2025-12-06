/**
 * @file BattleTasks.js
 * @description バトルシーンで使用するタスク（コマンド）のファクトリ関数。
 * TaskClassesの実装を利用してインスタンスを生成する。
 */
import { 
    WaitTask, MoveTask, ApplyStateTask, EventTask, CustomTask, DelegateTask 
} from './TaskClasses.js';

export const TaskType = {
    // 基本制御
    WAIT: 'WAIT',
    EVENT: 'EVENT',
    CUSTOM: 'CUSTOM',
    
    // ロジック制御
    APPLY_STATE: 'APPLY_STATE',
    
    // 演出・UI制御 (DelegateTaskを使用)
    MOVE: 'MOVE', // Moveはロジックで制御するがTaskClassesに実装済み
    ANIMATE: 'ANIMATE',      
    VFX: 'VFX',              
    CAMERA: 'CAMERA',        
    DIALOG: 'DIALOG',        
    UI_ANIMATION: 'UI_ANIMATION'
};

/**
 * 指定時間待機するタスク
 */
export const createWaitTask = (durationMs) => {
    return new WaitTask(durationMs);
};

/**
 * エンティティを指定位置へ移動させるタスク
 */
export const createMoveTask = (entityId, targetX, targetY, durationMs = 300) => {
    return new MoveTask(entityId, targetX, targetY, durationMs);
};

/**
 * ユニットのアニメーションを再生するタスク
 */
export const createAnimateTask = (attackerId, targetId, animationType = 'attack') => {
    return new DelegateTask(TaskType.ANIMATE, { attackerId, targetId, animationType });
};

/**
 * 汎用的な視覚効果(VFX)を再生するタスク
 */
export const createVfxTask = (effectName, position) => {
    return new DelegateTask(TaskType.VFX, { effectName, position });
};

/**
 * カメラを制御するタスク
 */
export const createCameraTask = (action, params = {}) => {
    return new DelegateTask(TaskType.CAMERA, { action, params });
};

/**
 * ダイアログ（メッセージ）を表示するタスク
 */
export const createDialogTask = (text, options = {}) => {
    return new DelegateTask(TaskType.DIALOG, { text, options });
};

/**
 * UI要素のアニメーションを実行するタスク
 */
export const createUiAnimationTask = (targetType, data) => {
    return new DelegateTask(TaskType.UI_ANIMATION, { targetType, data });
};

/**
 * 状態変化を適用するタスク（ロジック用）
 */
export const createApplyStateTask = (applyFn) => {
    return new ApplyStateTask(applyFn);
};

/**
 * 任意のイベントを発行するタスク
 */
export const createEventTask = (eventName, detail) => {
    return new EventTask(eventName, detail);
};

/**
 * 任意の非同期処理を実行するタスク
 */
export const createCustomTask = (asyncFn) => {
    return new CustomTask(asyncFn);
};