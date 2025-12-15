/**
 * @file TaskSystem.js
 * @description バトルアクション実行フェーズを担当するシステム。
 * BattleSequenceState が EXECUTING のエンティティの VisualSequence を処理し、完了したら FINISHED へ遷移させる。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, SequenceState, 
    VisualSequence, Visual 
} from '../../components/index.js';
import { 
    WaitTask, MoveTask, AnimateTask, EventTask, CustomTask,
    DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask
} from '../../components/Tasks.js';
import { GameEvents } from '../../../common/events.js';
import { RefreshUIRequest, CheckActionCancellationRequest } from '../../components/Requests.js';

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
        // 1. 各種タスクコンポーネントの実行処理
        this._processWaitTasks(deltaTime);
        this._processInstantTasks(); 
        
        // 2. シーケンス進行管理
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState !== SequenceState.EXECUTING) continue;

            this._updateSequence(entityId, state);
        }
    }

    _updateSequence(entityId, state) {
        // 現在実行中のタスクがあるかチェック（タスクコンポーネントがついている間は待機）
        const hasActiveTask = this.taskComponents.some(comp => this.world.getComponent(entityId, comp));
        if (hasActiveTask) return;

        // 次のタスクを取得
        const sequence = this.world.getComponent(entityId, VisualSequence);
        if (!sequence || !sequence.tasks || sequence.tasks.length === 0) {
            // タスクが空になった = シーケンス完了
            // VisualSequence コンポーネントを削除
            this.world.removeComponent(entityId, VisualSequence);
            
            // パイプライン状態を FINISHED に更新 (BattleSequenceSystemが回収する)
            state.currentState = SequenceState.FINISHED;
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
            // タスクコンポーネント付与 (これにより次のフレームからタスク処理が始まる)
            this.world.addComponent(entityId, new ComponentClass(...args));
        } catch (error) {
            console.error(`TaskSystem: Failed to create task component ${ComponentClass.name}`, error, args);
        }
    }

    // --- Task Processors (タスク自体のロジック) ---

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
        // EventTask: 適切なリクエストコンポーネントへの変換
        const eventEntities = this.getEntities(EventTask);
        for (const entityId of eventEntities) {
            const task = this.world.getComponent(entityId, EventTask);
            
            if (task.eventName === GameEvents.REFRESH_UI) {
                this.world.addComponent(this.world.createEntity(), new RefreshUIRequest());
            } else if (task.eventName === GameEvents.CHECK_ACTION_CANCELLATION) {
                this.world.addComponent(this.world.createEntity(), new CheckActionCancellationRequest());
            } else {
                // 互換性
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