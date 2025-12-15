/**
 * @file TurnSystem.js
 * @description ターン更新の管理システム。
 * イベント発行を廃止し、Signalコンポーネントの生成によるデータ指向の通知に移行。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState, ActionSelectionPending, SequencePending, BattleSequenceState } from '../../components/index.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
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

        // イベント発行(emit)の代わりにシグナルコンポーネントを生成
        // EffectSystemなどがこれを検知して処理を行う
        const signalEntity = this.world.createEntity();
        this.world.addComponent(signalEntity, new TurnEndedSignal(this.battleFlowState.turnNumber - 1));

        // 次のフェーズへ（自動遷移）
        // 1フレーム待つ必要がある場合はここでreturnするが、
        // 処理順序(TurnSystem -> EffectSystem)が保証されていれば即時遷移でも可。
        // ここではシグナルが処理される猶予を与えるため、次のupdateで遷移させるのが安全だが、
        // 既存ロジックに合わせて即時遷移しつつ、シグナルは残す。
        // EffectSystemはTurnEndedSignalを見つけ次第処理し、削除する責任を持つ必要はない（ComponentUpdateSystem等で掃除するか、自己破壊させる）。
        // ここでは「シグナルは1フレーム生存」とみなす設計にするため、システム側で削除させる。

        // 即時遷移
        this.battleFlowState.phase = BattlePhase.TURN_START;
    }

    _handleTurnStart() {
        // 即座に行動選択フェーズへ
        this.battleFlowState.phase = BattlePhase.ACTION_SELECTION;
    }

    // --- Completion Checks ---

    _checkActionSelectionCompletion() {
        // 条件:
        // 1. ActionSelectionPending を持つエンティティが存在しない（全員の選択機会が終了）
        // 2. 現在行動選択中のアクターがいない (battleFlowState.currentActorId === null)

        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length > 0) return;

        if (this.battleFlowState.currentActorId !== null) return;

        // 次のフェーズを決定
        // 優先度1: 実行待ちがいれば実行フェーズへ
        if (this._isAnyEntityReadyToExecute()) {
            this.battleFlowState.phase = BattlePhase.ACTION_EXECUTION;
            return;
        }

        // 優先度2: チャージ中の機体がいれば、フェーズを維持して待機 (ゲージ進行中)
        if (this._isAnyEntityCharging()) {
            return;
        }

        // 優先度3: 実行待ちもチャージ中もいなければターン終了
        this.battleFlowState.phase = BattlePhase.TURN_END;
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
                this.battleFlowState.phase = BattlePhase.ACTION_SELECTION;
            } else {
                this.battleFlowState.phase = BattlePhase.TURN_END;
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