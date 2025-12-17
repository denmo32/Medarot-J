/**
 * @file TurnSystem.js
 * @description ターン更新の管理システム。
 * 状態タグに基づいて進行判定を行う。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    ActionSelectionPending, SequencePending, BattleSequenceState,
    IsReadyToExecute, IsCharging, IsCooldown
} from '../../components/index.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { BattlePhase } from '../../common/constants.js';
import { TurnEndedSignal } from '../../components/Requests.js';

export class TurnSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);

        this.lastPhase = null;
    }

    update(deltaTime) {
        // --- フェーズ遷移検知 (Enter/Exit処理) ---
        if (this.battleFlowState.phase !== this.lastPhase) {
            this._onPhaseEnter(this.battleFlowState.phase);
            this.lastPhase = this.battleFlowState.phase;
        }

        // --- フェーズ完了監視と遷移ロジック ---

        switch (this.battleFlowState.phase) {
            case BattlePhase.ACTION_SELECTION:
                this._checkActionSelectionCompletion();
                break;

            case BattlePhase.ACTION_EXECUTION:
                this._checkActionExecutionCompletion();
                break;
        }
    }

    _onPhaseEnter(phase) {
        if (phase === BattlePhase.TURN_END) {
            this._handleTurnEnd();
        } else if (phase === BattlePhase.TURN_START) {
            this._handleTurnStart();
        }
    }

    _handleTurnEnd() {
        this.battleFlowState.turnNumber++;

        const signalEntity = this.world.createEntity();
        this.world.addComponent(signalEntity, new TurnEndedSignal(this.battleFlowState.turnNumber - 1));

        this.battleFlowState.phase = BattlePhase.TURN_START;
    }

    _handleTurnStart() {
        this.battleFlowState.phase = BattlePhase.ACTION_SELECTION;
    }

    // --- Completion Checks ---

    _checkActionSelectionCompletion() {
        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length > 0) return;

        if (this.battleFlowState.currentActorId !== null) return;

        // 次のフェーズを決定
        if (this._isAnyEntityReadyToExecute()) {
            this.battleFlowState.phase = BattlePhase.ACTION_EXECUTION;
            return;
        }

        // 優先度2: チャージ中(前進)または帰還中(後退)がいればフェーズ維持
        if (this._isAnyEntityMoving()) {
            return;
        }

        // 優先度3: 誰も動いていなければターン終了
        this.battleFlowState.phase = BattlePhase.TURN_END;
    }

    _checkActionExecutionCompletion() {
        const pending = this.getEntities(SequencePending);
        const executing = this.getEntities(BattleSequenceState);

        if (pending.length === 0 && executing.length === 0) {
            // 実行フェーズ完了
            if (this._isAnyEntityInAction()) {
                this.battleFlowState.phase = BattlePhase.ACTION_SELECTION;
            } else {
                this.battleFlowState.phase = BattlePhase.TURN_END;
            }
        }
    }

    // --- Helpers (Tag based checks) ---

    _isAnyEntityReadyToExecute() {
        return this.getEntities(IsReadyToExecute).length > 0;
    }

    _isAnyEntityMoving() {
        // IsCharging = 前進, IsCooldown = 後退
        const charging = this.getEntities(IsCharging);
        const cooling = this.getEntities(IsCooldown);
        // Note: SelectedCharging(前進)もChargingに統合された
        return charging.length > 0 || cooling.length > 0;
    }

    _isAnyEntityInAction() {
        // 誰かがチャージ中、クールダウン中、選択待機中ならアクション継続
        // ReadyToSelectは開始線にいるが選択待ち
        return this._isAnyEntityMoving() || this.getEntities(IsReadyToExecute).length > 0;
    }
}