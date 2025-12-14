/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フロー（開始、終了、初期化など）を管理するシステム。
 * イベント発行を廃止し、状態監視とリクエストコンポーネントへ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameState, Gauge, Action, ActionSelectionPending, PauseState, BattleResult } from '../../components/index.js';
import { UpdateComponentRequest, TransitionStateRequest } from '../../components/CommandRequests.js';
import { 
    ModalRequest, 
    BattleStartAnimationRequest, 
    BattleStartAnimationCompleted,
    ResetButtonResult
} from '../../components/Requests.js';
import { GameEvents } from '../../../common/events.js'; // シーン遷移イベントなどは残す
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        
        this.lastPhase = null;
    }

    update(deltaTime) {
        // フェーズ遷移検知
        // 注意: _onPhaseEnter内で this.phaseState.phase が変更される可能性があるため、
        // 処理開始時点のフェーズをキャプチャして判定・更新を行う。
        const currentPhase = this.phaseState.phase;
        if (currentPhase !== this.lastPhase) {
            this._onPhaseEnter(currentPhase);
            this.lastPhase = currentPhase;
        }

        // リセットリクエストの監視
        const resetRequests = this.getEntities(ResetButtonResult);
        for (const id of resetRequests) {
            this.world.destroyEntity(id);
            // シーン遷移イベント発行 (SceneManagerへの指示は例外的にイベントを使用)
            this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                sceneName: 'map',
                data: {}
            });
        }

        // アニメーション完了監視
        if (this.phaseState.phase === BattlePhase.BATTLE_START) {
             const completedTags = this.getEntities(BattleStartAnimationCompleted);
             if (completedTags.length > 0) {
                 this._onBattleAnimationCompleted();
                 for (const id of completedTags) this.world.destroyEntity(id);
             }
        }
    }

    _onPhaseEnter(phase) {
        switch (phase) {
            case BattlePhase.IDLE:
                // IDLEになったら即座に初期選択へ（シーンロード直後の流れ）
                this.phaseState.phase = BattlePhase.INITIAL_SELECTION;
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

    // --- INITIAL_SELECTION Logic ---
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

    // --- BATTLE_START Logic ---
    _onBattleAnimationCompleted() {
        const players = this.getEntities(GameState);
        players.forEach(id => {
            const req = this.world.createEntity();
            this.world.addComponent(req, new UpdateComponentRequest(id, Gauge, { value: 0 }));
        });

        this.phaseState.phase = BattlePhase.TURN_START;
    }

    // --- GAME_OVER Logic ---
    _handleGameOverEnter() {
        // 結果を取得
        const results = this.getEntities(BattleResult);
        let winningTeam = null;
        if (results.length > 0) {
            winningTeam = this.world.getComponent(results[0], BattleResult).winningTeam;
        }

        // モーダル表示リクエストを発行
        const req = this.world.createEntity();
        this.world.addComponent(req, new ModalRequest(
            ModalType.GAME_OVER,
            { winningTeam },
            { priority: 'high' }
        ));
    }
}