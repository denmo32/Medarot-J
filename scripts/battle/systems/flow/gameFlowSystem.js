/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フロー（開始、終了、初期化など）を管理するシステム。
 * BattleStateContext を廃止し、PauseStateとBattleResultコンポーネントを使用するように変更。
 */
import { System } from '../../../../engine/core/System.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameState, Gauge, Action, ActionSelectionPending, PauseState, BattleResult } from '../../components/index.js'; // 変更
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        
        // PauseState管理用のエンティティIDを保持（または毎回検索）
        this.pauseEntityId = null;
        
        this.lastPhase = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.on(GameEvents.GAME_PAUSED, this._onPause.bind(this));
        this.on(GameEvents.GAME_RESUMED, this._onResume.bind(this));
        
        // IDLEフェーズでのイベント
        this.on(GameEvents.GAME_START_CONFIRMED, this._onGameStartConfirmed.bind(this));
        
        // BATTLE_STARTフェーズでのイベント
        this.on('BATTLE_ANIMATION_COMPLETED', this._onBattleAnimationCompleted.bind(this));
        
        // GAME_OVERイベント
        this.on(GameEvents.GAME_OVER, this._onGameOver.bind(this));
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
            this.pauseEntityId = this.world.createEntity();
            this.world.addComponent(this.pauseEntityId, new PauseState());
        }
    }

    _onResume() {
        if (this.pauseEntityId !== null) {
            this.world.destroyEntity(this.pauseEntityId);
            this.pauseEntityId = null;
        } else {
            // 念のため全削除
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

    // --- INITIAL_SELECTION Logic (Initialization) ---
    _initializePlayersForBattle() {
        const players = this.getEntities(GameState, Gauge);
        const commands = [];
        
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            commands.push({
                type: 'UPDATE_COMPONENT',
                targetId: id,
                componentType: Gauge,
                updates: { value: 0 }
            });

            if (gameState.state !== PlayerStateType.BROKEN) {
                commands.push({
                    type: 'TRANSITION_STATE',
                    targetId: id,
                    newState: PlayerStateType.READY_SELECT
                });
                commands.push({
                    type: 'UPDATE_COMPONENT',
                    targetId: id,
                    componentType: Gauge,
                    updates: { value: gauge.max, speedMultiplier: 1.0 }
                });
                commands.push({
                    type: 'UPDATE_COMPONENT',
                    targetId: id,
                    componentType: Action,
                    updates: new Action() // reset
                });

                this.world.addComponent(id, new ActionSelectionPending());
            }
        });

        if (commands.length > 0) {
            const commandInstances = commands.map(cmd => createCommand(cmd.type, cmd));
            CommandExecutor.executeCommands(this.world, commandInstances);
        }
    }

    // --- BATTLE_START Logic ---
    _onBattleAnimationCompleted() {
        if (this.phaseState.phase === BattlePhase.BATTLE_START) {
            const players = this.getEntities(GameState);
            const commands = players.map(id => ({
                type: 'UPDATE_COMPONENT',
                targetId: id,
                componentType: Gauge,
                updates: { value: 0 }
            }));
            if (commands.length > 0) {
                const commandInstances = commands.map(cmd => createCommand(cmd.type, cmd));
                CommandExecutor.executeCommands(this.world, commandInstances);
            }

            this.phaseState.phase = BattlePhase.TURN_START;
        }
    }

    // --- GAME_OVER Logic ---
    _onGameOver(detail) {
        if (this.phaseState.phase !== BattlePhase.GAME_OVER) {
            this.phaseState.phase = BattlePhase.GAME_OVER;
            
            // 結果を保存するためのエンティティを作成
            const resultEntity = this.world.createEntity();
            this.world.addComponent(resultEntity, new BattleResult(detail.winningTeam));
        }
    }

    _handleGameOverEnter() {
        // 結果を取得
        const results = this.getEntities(BattleResult);
        let winningTeam = null;
        if (results.length > 0) {
            winningTeam = this.world.getComponent(results[0], BattleResult).winningTeam;
        }

        const timerEntity = this.world.createEntity();
        this.world.addComponent(timerEntity, new Timer(3000, () => {}));

        this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
    }
}