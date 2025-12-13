/**
 * @file TimelineBuilder.js
 * @description 演出指示データから、実行可能なタスクのリストを構築する。
 */
import { 
    createAnimateTask, 
    createEventTask, 
    createCustomTask,
    createDialogTask,
    createUiAnimationTask,
    createVfxTask,
    createCameraTask,
    createApplyVisualEffectTask
} from './BattleTasks.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
    }

    /**
     * 演出指示データの配列をタスクの配列に変換する
     * @param {Array<object>} visualSequence - 演出指示データの配列
     * @returns {Array<BattleTask>}
     */
    buildVisualSequence(visualSequence) {
        const tasks = [];
        if (!visualSequence) return tasks;
        
        for (const visual of visualSequence) {
            switch (visual.type) {
                case 'ANIMATE':
                    tasks.push(createAnimateTask(visual.attackerId, visual.targetId, visual.animationType));
                    break;
                case 'DIALOG':
                    tasks.push(createDialogTask(visual.text, visual.options));
                    break;
                case 'UI_ANIMATION':
                    tasks.push(createUiAnimationTask(visual.targetType, visual.data));
                    break;
                case 'VFX':
                    tasks.push(createVfxTask(visual.effectName, visual.position));
                    break;
                case 'CAMERA':
                    tasks.push(createCameraTask(visual.action, visual.params));
                    break;
                case 'EVENT':
                    tasks.push(createEventTask(visual.eventName, visual.detail));
                    break;
                case 'CUSTOM':
                    tasks.push(createCustomTask(visual.executeFn));
                    break;
                case 'APPLY_VISUAL_EFFECT':
                    tasks.push(createApplyVisualEffectTask(visual.targetId, visual.className));
                    break;
            }
        }

        return tasks;
    }
}