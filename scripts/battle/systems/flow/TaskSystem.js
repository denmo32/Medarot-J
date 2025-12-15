/**
 * @file TaskSystem.js
 * @description バトルアクション実行フェーズを担当するシステム。
 * VisualSequenceSystemが生成した純粋なデータ（JSONライク）を読み取り、
 * 適切なECSコンポーネントに変換して実行する「ファクトリ」の役割も担う。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, SequenceState, 
    VisualSequence, Visual 
} from '../../components/index.js';
import { 
    WaitTask, MoveTask, AnimateTask, CustomTask,
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
import {
    RefreshUIRequest,
    CheckActionCancellationRequest
} from '../../components/Requests.js';

export class TaskSystem extends System {
    constructor(world) {
        super(world);
        // 管理対象のタスクコンポーネント一覧 (実行中かどうかの判定に使用)
        this.taskComponents = [
            WaitTask, MoveTask, AnimateTask, CustomTask,
            DialogTask, VfxTask, CameraTask, UiAnimationTask, ApplyVisualEffectTask,
            StateControlTask
        ];
    }

    update(deltaTime) {
        // 1. 各種タスクコンポーネントの実行処理（既存）
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
        // 現在実行中のタスクがあるかチェック
        const hasActiveTask = this.taskComponents.some(comp => this.world.getComponent(entityId, comp));
        if (hasActiveTask) return;

        // 次のタスクデータを取得
        const sequence = this.world.getComponent(entityId, VisualSequence);
        if (!sequence || !sequence.tasks || sequence.tasks.length === 0) {
            // タスクが空になった = シーケンス完了
            this.world.removeComponent(entityId, VisualSequence);
            state.currentState = SequenceState.FINISHED;
            return;
        }

        const nextTaskData = sequence.tasks.shift();
        this._activateTask(entityId, nextTaskData);
    }

    /**
     * データ定義からコンポーネントを生成・付与する
     */
    _activateTask(entityId, taskData) {
        try {
            switch (taskData.type) {
                case 'WAIT':
                    this.world.addComponent(entityId, new WaitTask(taskData.duration || 0));
                    break;
                case 'ANIMATE':
                    this.world.addComponent(entityId, new AnimateTask(taskData.animationType, taskData.targetId));
                    break;
                case 'DIALOG':
                    this.world.addComponent(entityId, new DialogTask(taskData.text, taskData.options));
                    break;
                case 'UI_ANIMATION':
                    this.world.addComponent(entityId, new UiAnimationTask(taskData.targetType, taskData.data));
                    break;
                case 'VFX':
                    this.world.addComponent(entityId, new VfxTask(taskData.effectName, taskData.position));
                    break;
                case 'CAMERA':
                    this.world.addComponent(entityId, new CameraTask(taskData.action, taskData.params));
                    break;
                case 'STATE_CONTROL':
                    this.world.addComponent(entityId, new StateControlTask(taskData.updates));
                    break;
                case 'APPLY_VISUAL_EFFECT':
                    this.world.addComponent(entityId, new ApplyVisualEffectTask(taskData.targetId, taskData.className));
                    break;
                case 'CUSTOM':
                    this.world.addComponent(entityId, new CustomTask(taskData.executeFn));
                    break;
                    
                // 特殊: リクエスト生成タスク
                case 'CREATE_REQUEST':
                    this._handleCreateRequest(taskData);
                    // これは瞬時完了タスクとして扱うため、コンポーネントは付与せず再帰的に次へ進むか、
                    // 次のフレームで完了とみなす。ここではシンプルに次のフレームで完了処理させるため、
                    // ダミーのWait(0)を入れる。
                    this.world.addComponent(entityId, new WaitTask(0));
                    break;

                default:
                    console.error(`TaskSystem: Unknown task type '${taskData.type}'`);
                    break;
            }
        } catch (error) {
            console.error(`TaskSystem: Failed to activate task ${taskData.type}`, error);
        }
    }

    _handleCreateRequest(taskData) {
        const reqEntity = this.world.createEntity();
        switch (taskData.requestType) {
            case 'RefreshUIRequest':
                this.world.addComponent(reqEntity, new RefreshUIRequest());
                break;
            case 'CheckActionCancellationRequest':
                this.world.addComponent(reqEntity, new CheckActionCancellationRequest());
                break;
            default:
                console.warn(`TaskSystem: Unknown request type ${taskData.requestType}`);
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
        // StateControlTask
        const stateControlEntities = this.getEntities(StateControlTask);
        for (const entityId of stateControlEntities) {
            const task = this.world.getComponent(entityId, StateControlTask);
            this._applyStateUpdates(task.updates);
            this.world.removeComponent(entityId, StateControlTask);
        }

        // CustomTask
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