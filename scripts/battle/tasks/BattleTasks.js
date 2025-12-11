/**
 * @file BattleTasks.js
 * @description バトルタスクのファクトリ関数。
 */
import { ObjectPool } from '../../../engine/core/ObjectPool.js';
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

// --- Pools ---
const pools = {
    wait: new ObjectPool(() => new WaitTask(), t => t.reset(), 10),
    move: new ObjectPool(() => new MoveTask(), t => t.reset(), 5),
    animate: new ObjectPool(() => new AnimateTask(), t => t.reset(), 5),
    vfx: new ObjectPool(() => new VfxTask(), t => t.reset(), 5),
    camera: new ObjectPool(() => new CameraTask(), t => t.reset(), 2),
    dialog: new ObjectPool(() => new DialogTask(), t => t.reset(), 5),
    uiAnim: new ObjectPool(() => new UiAnimationTask(), t => t.reset(), 5),
    applyState: new ObjectPool(() => new ApplyStateTask(), t => t.reset(), 5),
    event: new ObjectPool(() => new EventTask(), t => t.reset(), 10),
    custom: new ObjectPool(() => new CustomTask(), t => t.reset(), 5)
};

// タスク完了時にプールへ返却するためのヘルパー (TaskRunnerで使用)
export const releaseTask = (task) => {
    switch(task.type) {
        case TaskType.WAIT: pools.wait.release(task); break;
        case TaskType.MOVE: pools.move.release(task); break;
        case TaskType.ANIMATE: pools.animate.release(task); break;
        case TaskType.VFX: pools.vfx.release(task); break;
        case TaskType.CAMERA: pools.camera.release(task); break;
        case TaskType.DIALOG: pools.dialog.release(task); break;
        case TaskType.UI_ANIMATION: pools.uiAnim.release(task); break;
        case TaskType.APPLY_STATE: pools.applyState.release(task); break;
        case TaskType.EVENT: pools.event.release(task); break;
        case TaskType.CUSTOM: pools.custom.release(task); break;
    }
};

// --- Factories ---

export const createWaitTask = (durationMs) => 
    pools.wait.acquire().init(durationMs);

export const createMoveTask = (entityId, targetX, targetY, durationMs = 300) => 
    pools.move.acquire().init(entityId, targetX, targetY, durationMs);

export const createAnimateTask = (attackerId, targetId, animationType = 'attack') => 
    pools.animate.acquire().init(attackerId, targetId, animationType);

export const createVfxTask = (effectName, position) => 
    pools.vfx.acquire().init(effectName, position);

export const createCameraTask = (action, params = {}) => 
    pools.camera.acquire().init(action, params);

export const createDialogTask = (text, options = {}) => 
    pools.dialog.acquire().init(text, options);

export const createUiAnimationTask = (targetType, data) => 
    pools.uiAnim.acquire().init(targetType, data);

export const createApplyStateTask = (commands) => 
    pools.applyState.acquire().init(commands);

export const createEventTask = (eventName, detail) => 
    pools.event.acquire().init(eventName, detail);

export const createCustomTask = (asyncFn) => 
    pools.custom.acquire().init(asyncFn);