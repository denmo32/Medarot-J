/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フロー（開始、終了、初期化など）を管理するシステム。
 * イベント発行を廃止し、ModalRequestコンポーネントの生成へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameState, Gauge, Action, ActionSelectionPending, PauseState, BattleResult } from '../../components/index.js';
import { UpdateComponentRequest, TransitionStateRequest } from '../../components/CommandRequests.js';
import { ModalRequest } from '../../components/Requests.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        
        this.pauseEntityId = null;
        this.lastPhase = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.on(GameEvents.GAME_PAUSED, this._onPause.bind(this));
        this.on(GameEvents.GAME_RESUMED, this._onResume.bind(this));
        
        this.on(GameEvents.GAME_START_CONFIRMED, this._onGameStartConfirmed.bind(this));
        this.on('BATTLE_ANIMATION_COMPLETED', this._onBattleAnimationCompleted.bind(this));
        
        // GAME_OVERイベントはWinConditionSystemがPhaseStateを更新するため、
        // ここでのリスナーは削除しても機能しますが、念のため残す場合はPhaseStateの整合性を保つ役割のみにします
    }

    update(deltaTime) {
        if (this.phaseState.phase !== this.lastPhase) {
            this._onPhaseEnter(this.phaseState.phase);
            this.lastPhase = this.phaseState.phase;
        }

        switch (this.phaseState.phase) {
            case BattlePhase.IDLE:
            case BattlePhase.BATTLE_START:
            case BattlePhase.GAME_OVER:
                break;
        }
    }

    _onPhaseEnter(phase) {
        switch (phase) {
            case BattlePhase.IDLE:
                break;

            case BattlePhase.INITIAL_SELECTION:
                this._initializePlayersForBattle();
                break;

            case BattlePhase.BATTLE_START:
                this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
                break;
                
            case BattlePhase.GAME_OVER:
                this._handleGameOverEnter();
                break;
        }
    }

    _onPause() {
        if (!this.pauseEntityId) {
            const entities = this.getEntities(PauseState);
            if (entities.length === 0) {
                this.pauseEntityId = this.world.createEntity();
                this.world.addComponent(this.pauseEntityId, new PauseState());
            } else {
                this.pauseEntityId = entities[0];
            }
        }
    }

    _onResume() {
        if (this.pauseEntityId !== null) {
            if (this.world.entities.has(this.pauseEntityId)) {
                this.world.destroyEntity(this.pauseEntityId);
            }
            this.pauseEntityId = null;
        } else {
            const entities = this.getEntities(PauseState);
            for (const id of entities) {
                this.world.destroyEntity(id);
            }
        }
    }

    // --- IDLE Logic ---
    _onGameStartConfirmed() {
        if (this.phaseState.phase === BattlePhase.IDLE) {
            this.phaseState.phase = BattlePhase.INITIAL_SELECTION;
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
        if (this.phaseState.phase === BattlePhase.BATTLE_START) {
            const players = this.getEntities(GameState);
            players.forEach(id => {
                const req = this.world.createEntity();
                this.world.addComponent(req, new UpdateComponentRequest(id, Gauge, { value: 0 }));
            });

            this.phaseState.phase = BattlePhase.TURN_START;
        }
    }

    // --- GAME_OVER Logic ---
    _handleGameOverEnter() {
        // 結果を取得
        const results = this.getEntities(BattleResult);
        let winningTeam = null;
        if (results.length > 0) {
            winningTeam = this.world.getComponent(results[0], BattleResult).winningTeam;
        }

        // タイマーは画面遷移までのディレイなどに使用可能だが、ここではUI表示を優先
        const timerEntity = this.world.createEntity();
        this.world.addComponent(timerEntity, new Timer(3000, () => {}));

        // モーダル表示リクエストを発行
        const req = this.world.createEntity();
        this.world.addComponent(req, new ModalRequest(
            ModalType.GAME_OVER,
            { winningTeam },
            { priority: 'high' }
        ));
    }
}