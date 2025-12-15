/**
 * @file TimelineBuilder.js
 * @description 演出指示データから、タスクコンポーネントの定義（ファクトリ関数やデータオブジェクト）の配列を構築する。
 * オブジェクトプールやクラスインスタンスの生成は行わず、純粋なデータ変換を行う。
 */
import { 
    AnimateTask, 
    EventTask, 
    CustomTask,
    DialogTask, 
    UiAnimationTask, 
    VfxTask, 
    CameraTask,
    ApplyVisualEffectTask,
    StateControlTask
} from '../components/Tasks.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
    }

    /**
     * 演出指示データの配列をタスクコンポーネント生成情報の配列に変換する
     * @param {Array<object>} visualSequence - 演出指示データの配列
     * @returns {Array<object>} { componentClass, args } の配列
     */
    buildVisualSequence(visualSequence) {
        const tasks = [];
        if (!visualSequence) return tasks;
        
        for (const visual of visualSequence) {
            switch (visual.type) {
                case 'ANIMATE':
                    tasks.push({ 
                        componentClass: AnimateTask, 
                        args: [visual.animationType, visual.targetId] 
                    });
                    break;
                case 'DIALOG':
                    tasks.push({ 
                        componentClass: DialogTask, 
                        args: [visual.text, visual.options] 
                    });
                    break;
                case 'UI_ANIMATION':
                    tasks.push({ 
                        componentClass: UiAnimationTask, 
                        args: [visual.targetType, visual.data] 
                    });
                    break;
                case 'VFX':
                    tasks.push({ 
                        componentClass: VfxTask, 
                        args: [visual.effectName, visual.position] 
                    });
                    break;
                case 'CAMERA':
                    tasks.push({ 
                        componentClass: CameraTask, 
                        args: [visual.action, visual.params] 
                    });
                    break;
                case 'EVENT':
                    tasks.push({ 
                        componentClass: EventTask, 
                        args: [visual.eventName, visual.detail] 
                    });
                    break;
                case 'STATE_CONTROL':
                    tasks.push({
                        componentClass: StateControlTask,
                        args: [visual.updates]
                    });
                    break;
                case 'CUSTOM':
                    tasks.push({ 
                        componentClass: CustomTask, 
                        args: [visual.executeFn] 
                    });
                    break;
                case 'APPLY_VISUAL_EFFECT':
                    tasks.push({ 
                        componentClass: ApplyVisualEffectTask, 
                        args: [visual.targetId, visual.className] 
                    });
                    break;
            }
        }

        return tasks;
    }
}