/**
 * @file BattleTasks.js
 * @description バトルタスクのファクトリ関数。
 * 新しいクラス定義に合わせて更新。
 */
import { 
    WaitTask, MoveTask, ApplyStateTask, EventTask, CustomTask,
    AnimateTask, VfxTask, CameraTask, DialogTask, UiAnimationTask
} from './TaskClasses.js';

export const TaskType = {
    WAIT: 'WAIT',
    EVENT: 'EVENT',
    CUSTOM: 'CUSTOM',
    APPLY_STATE: 'APPLY_STATE',
    MOVE: 'MOVE',
    ANIMATE: 'ANIMATE',      
    VFX: 'VFX',              
    CAMERA: 'CAMERA',        
    DIALOG: 'DIALOG',        
    UI_ANIMATION: 'UI_ANIMATION'
};

export const createWaitTask = (durationMs) => new WaitTask(durationMs);

export const createMoveTask = (entityId, targetX, targetY, durationMs = 300) => 
    new MoveTask(entityId, targetX, targetY, durationMs);

export const createAnimateTask = (attackerId, targetId, animationType = 'attack') => 
    new AnimateTask(attackerId, targetId, animationType);

export const createVfxTask = (effectName, position) => 
    new VfxTask(effectName, position);

export const createCameraTask = (action, params = {}) => 
    new CameraTask(action, params);

export const createDialogTask = (text, options = {}) => 
    new DialogTask(text, options);

export const createUiAnimationTask = (targetType, data) => 
    new UiAnimationTask(targetType, data);

export const createApplyStateTask = (applyFn) => new ApplyStateTask(applyFn);

export const createEventTask = (eventName, detail) => new EventTask(eventName, detail);

export const createCustomTask = (asyncFn) => new CustomTask(asyncFn);