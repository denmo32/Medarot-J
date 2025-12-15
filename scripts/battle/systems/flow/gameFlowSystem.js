/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フロー（開始、終了、初期化など）を管理するシステム。
 * シーン遷移イベントをSceneChangeRequestコンポーネントの生成へ変更。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { GameState, Gauge, Action, ActionSelectionPending, BattleResult } from '../../components/index.js';
import { UpdateComponentRequest, TransitionStateRequest } from '../../components/CommandRequests.js';
import { ModalState } from '../../components/States.js';
import {
    BattleStartAnimationRequest,
    BattleStartAnimationCompleted,
    ResetButtonResult
} from '../../components/Requests.js';
import { SceneChangeRequest } from '../../../components/SceneRequests.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);

        this.lastPhase = null;
    }

    update(deltaTime) {
        // フェーズ遷移検知
        const currentPhase = this.battleFlowState.phase;
        if (currentPhase !== this.lastPhase) {
            this._onPhaseEnter(currentPhase);
            this.lastPhase = currentPhase;
        }

        // リセットリクエストの監視
        const resetRequests = this.getEntities(ResetButtonResult);
        for (const id of resetRequests) {
            this.world.destroyEntity(id);

            // シーン遷移リクエスト生成
            const req = this.world.createEntity();
            this.world.addComponent(req, new SceneChangeRequest('map', {
                // 必要に応じて結果データを渡す
                battleResult: this._getBattleResult()
            }));
        }

        // アニメーション完了監視
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
        const players = this.getEntities(GameState, Gauge);

        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);

            const req1 = this.world.createEntity();
            this.world.addComponent(req1, new UpdateComponentRequest(id, Gauge, { value: 0 }));

            if (gameState.state !== PlayerStateType.BROKEN) {
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
        const players = this.getEntities(GameState);
        players.forEach(id => {
            const req = this.world.createEntity();
            this.world.addComponent(req, new UpdateComponentRequest(id, Gauge, { value: 0 }));
        });

        this.battleFlowState.phase = BattlePhase.TURN_START;
    }

    _handleGameOverEnter() {
        const winningTeam = this.battleFlowState.winningTeam;

        const stateEntity = this.world.createEntity();
        const modalState = new ModalState();
        modalState.type = ModalType.GAME_OVER;
        modalState.data = { winningTeam };
        modalState.priority = 'high';
        // modalState.isNewはデフォルトでtrue
        this.world.addComponent(stateEntity, modalState);
    }
}