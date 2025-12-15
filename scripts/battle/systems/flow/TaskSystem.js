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
    WaitTask, MoveTask, AnimateTask, CreateEntityTask, CustomTask,
    DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask,
    StateControlTask
} from '../../components/Tasks.js';
import {
    SetPlayerBrokenRequest,
    ResetToCooldownRequest,
    TransitionStateRequest,
    UpdateComponentRequest,
    CustomUpdateComponentRequest,
    TransitionToCooldownRequest
} from '../../components/CommandRequests.js';

export class TaskSystem extends System {
    constructor(world) {
        super(world);
        // 管理対象のタスクコンポーネント一覧
        this.taskComponents = [
            WaitTask, MoveTask, AnimateTask, CreateEntityTask, CustomTask,
            DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask,
            StateControlTask
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
            this.world.removeComponent(entityId, VisualSequence);
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
        // CreateEntityTask: 汎用的なエンティティ生成 (リクエスト発行など)
        const createEntities = this.getEntities(CreateEntityTask);
        for (const entityId of createEntities) {
            const task = this.world.getComponent(entityId, CreateEntityTask);
            
            if (task.componentsDef && Array.isArray(task.componentsDef)) {
                const newEntityId = this.world.createEntity();
                for (const def of task.componentsDef) {
                    const CompClass = def.componentClass;
                    const args = def.args || [];
                    try {
                        this.world.addComponent(newEntityId, new CompClass(...args));
                    } catch (e) {
                        console.error(`TaskSystem: Failed to attach component ${CompClass.name}`, e);
                    }
                }
            }
            this.world.removeComponent(entityId, CreateEntityTask);
        }

        // StateControlTask: コマンドリクエストへの変換 (データ駆動)
        const stateControlEntities = this.getEntities(StateControlTask);
        for (const entityId of stateControlEntities) {
            const task = this.world.getComponent(entityId, StateControlTask);
            this._applyStateUpdates(task.updates);
            this.world.removeComponent(entityId, StateControlTask);
        }

        // CustomTask: クロージャ実行
        const customEntities = this.getEntities(CustomTask);
        for (const entityId of customEntities) {
            const task = this.world.getComponent(entityId, CustomTask);
            if (task.executeFn) task.executeFn(this.world, entityId);
            this.world.removeComponent(entityId, CustomTask);
        }

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
        
        // VfxTask, CameraTask (VisualDirectorSystemが処理するためここでは削除しない)
    }

    _applyStateUpdates(updates) {
        if (!updates) return;
        for (const update of updates) {
            const reqEntity = this.world.createEntity();
            switch (update.type) {
                case 'SetPlayerBroken': 
                    this.world.addComponent(reqEntity, new SetPlayerBrokenRequest(update.targetId)); 
                    break;
                case 'ResetToCooldown': 
                    this.world.addComponent(reqEntity, new ResetToCooldownRequest(update.targetId, update.options)); 
                    break;
                case 'TransitionState': 
                    this.world.addComponent(reqEntity, new TransitionStateRequest(update.targetId, update.newState)); 
                    break;
                case 'UpdateComponent': 
                    this.world.addComponent(reqEntity, new UpdateComponentRequest(update.targetId, update.componentType, update.updates)); 
                    break;
                case 'CustomUpdateComponent': 
                    this.world.addComponent(reqEntity, new CustomUpdateComponentRequest(update.targetId, update.componentType, update.customHandler)); 
                    break;
                case 'TransitionToCooldown': 
                    this.world.addComponent(reqEntity, new TransitionToCooldownRequest(update.targetId)); 
                    break;
            }
        }
    }
}