/**
 * @file TaskSystem.js
 * @description VisualSequenceを持つエンティティのタスク進行を管理するシステム。
 * イベント発行タスク(EventTask)を、ECSのリクエスト生成処理に置換して処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { VisualSequence } from '../../components/index.js';
import { 
    WaitTask, MoveTask, AnimateTask, EventTask, CustomTask,
    DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask
} from '../../components/Tasks.js';
import { Visual } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { 
    RefreshUIRequest, 
    CheckActionCancellationRequest 
} from '../../components/Requests.js';

export class TaskSystem extends System {
    constructor(world) {
        super(world);
        // 管理対象のタスクコンポーネント一覧
        this.taskComponents = [
            WaitTask, MoveTask, AnimateTask, EventTask, CustomTask,
            DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask
        ];
    }

    update(deltaTime) {
        // 1. 各種タスクの実行処理
        this._processWaitTasks(deltaTime);
        this._processInstantTasks(); 
        
        // 2. シーケンス進行管理
        const entities = this.getEntities(VisualSequence);
        for (const entityId of entities) {
            this._updateSequence(entityId);
        }
    }

    _updateSequence(entityId) {
        // 現在実行中のタスクがあるかチェック
        const hasActiveTask = this.taskComponents.some(comp => this.world.getComponent(entityId, comp));
        if (hasActiveTask) return;

        // 次のタスクを取得
        const sequence = this.world.getComponent(entityId, VisualSequence);
        if (!sequence || !sequence.tasks || sequence.tasks.length === 0) {
            // シーケンス完了
            this.world.removeComponent(entityId, VisualSequence);
            return;
        }

        const nextTaskDef = sequence.tasks.shift();
        
        if (!nextTaskDef || !nextTaskDef.componentClass) {
            console.error(`TaskSystem: Invalid task definition encountered for entity ${entityId}`, nextTaskDef);
            return;
        }

        const ComponentClass = nextTaskDef.componentClass;
        const args = nextTaskDef.args || []; 

        try {
            // コンポーネント付与
            this.world.addComponent(entityId, new ComponentClass(...args));
        } catch (error) {
            console.error(`TaskSystem: Failed to create task component ${ComponentClass.name}`, error, args);
        }
    }

    // --- Task Processors ---

    _processWaitTasks(deltaTime) {
        const entities = this.getEntities(WaitTask);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, WaitTask);
            task.elapsed += deltaTime;
            if (task.elapsed >= task.duration) {
                this.world.removeComponent(entityId, WaitTask);
            }
        }
    }

    _processInstantTasks() {
        // EventTask: イベント発行の代わりに適切なリクエストコンポーネントを生成
        const eventEntities = this.getEntities(EventTask);
        for (const entityId of eventEntities) {
            const task = this.world.getComponent(entityId, EventTask);
            
            // イベント名に応じたリクエスト生成 (イベント駆動からの脱却)
            if (task.eventName === GameEvents.REFRESH_UI) {
                const req = this.world.createEntity();
                this.world.addComponent(req, new RefreshUIRequest());
            } else if (task.eventName === GameEvents.CHECK_ACTION_CANCELLATION) {
                const req = this.world.createEntity();
                this.world.addComponent(req, new CheckActionCancellationRequest());
            } else {
                // 互換性のために一応emitを残すが、原則使用しない
                // console.warn(`TaskSystem: Emitting legacy event ${task.eventName}. Convert to Request Component.`);
                this.world.emit(task.eventName, task.detail);
            }
            
            this.world.removeComponent(entityId, EventTask);
        }

        // CustomTask
        const customEntities = this.getEntities(CustomTask);
        for (const entityId of customEntities) {
            const task = this.world.getComponent(entityId, CustomTask);
            if (task.executeFn) task.executeFn(this.world, entityId);
            this.world.removeComponent(entityId, CustomTask);
        }

        // VfxTask (VisualDirectorSystemが処理するためここでは削除しない)
        // CameraTask (VisualDirectorSystemが処理するためここでは削除しない)

        // ApplyVisualEffectTask
        const visualEntities = this.getEntities(ApplyVisualEffectTask);
        for (const entityId of visualEntities) {
            const task = this.world.getComponent(entityId, ApplyVisualEffectTask);
            const targetId = task.targetEntityId !== null ? task.targetEntityId : entityId;
            const visual = this.world.getComponent(targetId, Visual);
            if (visual) {
                visual.classes.add(task.className);
            }
            this.world.removeComponent(entityId, ApplyVisualEffectTask);
        }
    }
}