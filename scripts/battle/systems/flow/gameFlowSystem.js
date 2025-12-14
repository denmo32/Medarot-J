/**
 * @file GameFlowSystem.js
 * @description ゲーム全体の進行フロー（開始、終了、初期化など）を管理するシステム。
 * 初期化時のキューリクエストをActionSelectionPendingコンポーネントの付与に変更。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleStateContext } from '../../components/BattleStateContext.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { GameState, Gauge, Action, ActionSelectionPending } from '../../components/index.js'; // 追加
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../common/constants.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleStateContext = this.world.getSingletonComponent(BattleStateContext);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        
        // フェーズ遷移検知用
        this.lastPhase = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.on(GameEvents.GAME_PAUSED, () => { this.battleStateContext.isPaused = true; });
        this.on(GameEvents.GAME_RESUMED, () => { this.battleStateContext.isPaused = false; });
        
        // IDLEフェーズでのイベント
        this.on(GameEvents.GAME_START_CONFIRMED, this._onGameStartConfirmed.bind(this));
        
        // BATTLE_STARTフェーズでのイベント
        this.on('BATTLE_ANIMATION_COMPLETED', this._onBattleAnimationCompleted.bind(this));
        
        // GAME_OVERイベント
        this.on(GameEvents.GAME_OVER, this._onGameOver.bind(this));
    }

    update(deltaTime) {
        // フェーズ遷移検知（Enter処理）
        if (this.phaseContext.phase !== this.lastPhase) {
            this._onPhaseEnter(this.phaseContext.phase);
            this.lastPhase = this.phaseContext.phase;
        }

        // フェーズごとの更新処理 (Update処理)
        switch (this.phaseContext.phase) {
            case BattlePhase.IDLE:
                // イベント待ちのため特になし
                break;
            case BattlePhase.BATTLE_START:
                // アニメーション完了待ちのため特になし
                break;
            case BattlePhase.GAME_OVER:
                // 終了状態
                break;
        }
    }

    _onPhaseEnter(phase) {
        switch (phase) {
            case BattlePhase.IDLE:
                // 初期状態
                break;

            case BattlePhase.INITIAL_SELECTION:
                this._initializePlayersForBattle();
                break;

            case BattlePhase.BATTLE_START:
                this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
                break;
                
            case BattlePhase.GAME_OVER:
                // WinConditionSystemから遷移してくる
                this._handleGameOverEnter();
                break;
        }
    }

    // --- IDLE Logic ---
    _onGameStartConfirmed() {
        if (this.phaseContext.phase === BattlePhase.IDLE) {
            this.phaseContext.phase = BattlePhase.INITIAL_SELECTION;
        }
    }

    // --- INITIAL_SELECTION Logic (Initialization) ---
    _initializePlayersForBattle() {
        // 全プレイヤーのゲージをリセットし、選択可能な状態にする
        const players = this.getEntities(GameState, Gauge);
        const commands = [];
        
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            // ゲージを0にリセット
            commands.push({
                type: 'UPDATE_COMPONENT',
                targetId: id,
                componentType: Gauge,
                updates: { value: 0 }
            });

            if (gameState.state !== PlayerStateType.BROKEN) {
                // 状態をREADY_SELECTへ
                commands.push({
                    type: 'TRANSITION_STATE',
                    targetId: id,
                    newState: PlayerStateType.READY_SELECT
                });
                // 初期選択用: ゲージ満タン、アクションリセット
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

                // キューリクエスト: コンポーネントを付与
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
        if (this.phaseContext.phase === BattlePhase.BATTLE_START) {
            // アニメーション完了後、ゲージを再度0にしてターン開始へ
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

            this.phaseContext.phase = BattlePhase.TURN_START;
        }
    }

    // --- GAME_OVER Logic ---
    _onGameOver(detail) {
        if (this.phaseContext.phase !== BattlePhase.GAME_OVER) {
            this.phaseContext.phase = BattlePhase.GAME_OVER;
            this.battleStateContext.winningTeam = detail.winningTeam;
        }
    }

    _handleGameOverEnter() {
        const winningTeam = this.battleStateContext.winningTeam;
        
        // タイマーエンティティを作成してシーン遷移を予約
        const timerEntity = this.world.createEntity();
        this.world.addComponent(timerEntity, new Timer(3000, () => {
             // 自動遷移処理（必要であれば）
        }));

        this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
    }
}