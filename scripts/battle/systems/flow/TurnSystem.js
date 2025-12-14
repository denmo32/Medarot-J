/**
 * @file TurnSystem.js
 * @description ターン更新の管理システム。
 * フェーズの終了条件を毎フレーム監視し、条件を満たした時に遷移を行う。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState, ActionSelectionPending, SequencePending, BattleSequenceState } from '../../components/index.js'; 
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';

export class TurnSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        
        this.lastPhase = null;
    }

    update(deltaTime) {
        // --- フェーズ遷移イベント検知 (Enter/Exit処理) ---
        if (this.phaseState.phase !== this.lastPhase) {
            this._onPhaseEnter(this.phaseState.phase);
            this.lastPhase = this.phaseState.phase;
        }

        // --- フェーズ完了監視と遷移ロジック ---
        
        switch (this.phaseState.phase) {
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
        this.turnContext.number++;
        this.world.emit(GameEvents.TURN_END, { turnNumber: this.turnContext.number - 1 });
        this.world.emit(GameEvents.TURN_START, { turnNumber: this.turnContext.number });
        this.phaseState.phase = BattlePhase.TURN_START;
    }

    _handleTurnStart() {
        // TURN_STARTでの処理（ログ表示など）が終わったら即座にACTION_SELECTIONへ
        this.phaseState.phase = BattlePhase.ACTION_SELECTION;
    }

    // --- Completion Checks ---

    _checkActionSelectionCompletion() {
        // 条件: 
        // 1. ActionSelectionPending を持つエンティティが存在しない（全員の選択機会が終了）
        // 2. 現在行動選択中のアクターがいない (TurnContext.currentActorId === null)
        
        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length > 0) return;

        if (this.turnContext.currentActorId !== null) return;

        // 次のフェーズを決定
        // 優先度1: 実行待ちがいれば実行フェーズへ
        if (this._isAnyEntityReadyToExecute()) {
            this.phaseState.phase = BattlePhase.ACTION_EXECUTION;
            return;
        } 
        
        // 優先度2: チャージ中の機体がいれば、フェーズを維持して待機 (ゲージ進行中)
        if (this._isAnyEntityCharging()) {
            return;
        }

        // 優先度3: 実行待ちもチャージ中もいなければターン終了
        this.phaseState.phase = BattlePhase.TURN_END;
    }

    _checkActionExecutionCompletion() {
        // 条件:
        // 1. SequencePending を持つエンティティがいない
        // 2. BattleSequenceState を持つエンティティがいない
        
        const pending = this.getEntities(SequencePending);
        const executing = this.getEntities(BattleSequenceState);

        if (pending.length === 0 && executing.length === 0) {
            // 実行フェーズ完了
            if (this._isAnyEntityInAction()) {
                this.phaseState.phase = BattlePhase.ACTION_SELECTION;
            } else {
                this.phaseState.phase = BattlePhase.TURN_END;
            }
        }
    }

    // --- Helpers ---

    _isAnyEntityReadyToExecute() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
    }

    _isAnyEntityCharging() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || 
                   state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }

    _isAnyEntityInAction() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || 
                   state.state === PlayerStateType.READY_SELECT ||
                   state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}