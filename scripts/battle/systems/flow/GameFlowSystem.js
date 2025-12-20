/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フローを管理するシステム。
 * コンポーネント生成による初期化へ変更。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { Gauge, Action, ActionSelectionPending, BattleResult, IsBroken } from '../../components/index.js';
import { UpdateComponentRequest, TransitionStateRequest } from '../../components/CommandRequests.js';
import { ModalState } from '../../components/States.js';
import {
    BattleStartAnimationRequest,
    BattleStartAnimationCompleted
    // ResetButtonResult // 古いコンポーネントは削除
} from '../../components/Requests.js';
import { SceneChangeRequest } from '../../../components/SceneRequests.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';
import { BattleStartConfirmedRequest, ResetButtonClickedRequest } from '../../../components/Events.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);

        this.lastPhase = null;
    }

    update(deltaTime) {
        const currentPhase = this.battleFlowState.phase;
        if (currentPhase !== this.lastPhase) {
            this._onPhaseEnter(currentPhase);
            this.lastPhase = currentPhase;
        }

        // BattleStartConfirmedRequestを検知して、BATTLE_STARTフェーズに遷移
        const startConfirmedRequests = this.getEntities(BattleStartConfirmedRequest);
        for (const id of startConfirmedRequests) {
            this.battleFlowState.phase = BattlePhase.BATTLE_START;
            this.world.destroyEntity(id); // リクエストは処理後削除
        }

        const resetRequests = this.getEntities(ResetButtonClickedRequest);
        for (const id of resetRequests) {
            this.world.destroyEntity(id);
            const req = this.world.createEntity();
            this.world.addComponent(req, new SceneChangeRequest('map', {
                battleResult: this._getBattleResult()
            }));
        }

        if (this.battleFlowState.phase === BattlePhase.BATTLE_START) {
             const completedTags = this.getEntities(BattleStartAnimationCompleted);
             if (completedTags.length > 0) {
                 this._onBattleAnimationCompleted();
                 for (const id of completedTags) this.world.destroyEntity(id);
             }
        }
    }

    _getBattleResult() {
        const results = this.getEntities(BattleResult);
        if (results.length > 0) {
            return this.world.getComponent(results[0], BattleResult);
        }
        return null;
    }

    _onPhaseEnter(phase) {
        switch (phase) {
            case BattlePhase.IDLE:
                this.battleFlowState.phase = BattlePhase.INITIAL_SELECTION;
                break;

            case BattlePhase.INITIAL_SELECTION:
                this._initializePlayersForBattle();
                break;

            case BattlePhase.BATTLE_START:
                this.world.addComponent(this.world.createEntity(), new BattleStartAnimationRequest());
                break;

            case BattlePhase.GAME_OVER:
                this._handleGameOverEnter();
                break;
        }
    }

    _initializePlayersForBattle() {
        // GameStateではなくGaugeを持つエンティティ（プレイヤー）を対象にする
        const players = this.getEntities(Gauge);

        players.forEach(id => {
            const gauge = this.world.getComponent(id, Gauge);
            const isBroken = this.world.getComponent(id, IsBroken);

            const req1 = this.world.createEntity();
            this.world.addComponent(req1, new UpdateComponentRequest(id, Gauge, { value: 0 }));

            if (!isBroken) {
                // 初期状態として ReadyToSelect へ遷移させる
                const req2 = this.world.createEntity();
                this.world.addComponent(req2, new TransitionStateRequest(id, PlayerStateType.READY_SELECT));

                const req3 = this.world.createEntity();
                this.world.addComponent(req3, new UpdateComponentRequest(id, Gauge, { value: gauge.max, speedMultiplier: 1.0 }));

                const req4 = this.world.createEntity();
                this.world.addComponent(req4, new UpdateComponentRequest(id, Action, new Action()));

                this.world.addComponent(id, new ActionSelectionPending());
            }
        });
    }

    _onBattleAnimationCompleted() {
        // アニメーション完了後、初期選択した機体のゲージを0リセット（ここからチャージ開始）
        // ただし初期化時にREADY_SELECTにした際、ゲージMAXにしているので、
        // コマンド選択が完了した時点でSELECTED_CHARGINGになり、ゲージ0になっているはず。
        // ここでのリセットは「選択されなかった機体」や「何らかの理由で残っている値」の掃除。
        
        // 注意: INITIAL_SELECTIONフェーズで選択された機体は既に TransitionStateRequest で SELECTED_CHARGING (IsCharging) になり、
        // 同時にゲージ0になっている。
        
        this.battleFlowState.phase = BattlePhase.TURN_START;
    }

    _handleGameOverEnter() {
        const winningTeam = this.battleFlowState.winningTeam;

        const stateEntity = this.world.createEntity();
        const modalState = new ModalState();
        modalState.type = ModalType.GAME_OVER;
        modalState.data = { winningTeam };
        modalState.priority = 'high';
        this.world.addComponent(stateEntity, modalState);
    }
}