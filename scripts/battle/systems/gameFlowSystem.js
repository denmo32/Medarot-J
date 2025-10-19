import { BaseSystem } from '../../core/baseSystem.js';
import { GameState, Gauge, PlayerInfo, Action } from '../core/components/index.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { GameEvents } from '../common/events.js';
import { GamePhaseType, PlayerStateType, TeamID, ModalType } from '../common/constants.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * ゲーム全体のフロー（開始、戦闘、終了、リセット）を管理するシステム。
 * ゲームのグローバルな状態(GameContext)を唯一変更する責務を持つ。
 * Note: After context separation, this system now interacts with multiple context components:
 * - BattlePhaseContext: for battle phase changes
 * - UIStateContext: for pausing and message queue
 * - GameContext: for the final winning team result
 */
export class GameFlowSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // Use new context components for their specific responsibilities
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
        
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.world.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CANCELLED, this.onBattleStartCancelled.bind(this));
        this.world.on(GameEvents.BATTLE_ANIMATION_COMPLETED, this.onBattleAnimationCompleted.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        // UIからのゲーム一時停止/再開イベントを購読し、ゲーム全体のポーズ状態を一元管理します。
        this.world.on(GameEvents.GAME_PAUSED, this.onGamePaused.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onGameResumed.bind(this));
    }

    /**
     * ゲームの一時停止を処理するハンドラ。
     * ViewSystemから発行されたイベントを受け、UIStateContextのフラグを更新します。
     * UIの都合によるゲーム停止が、コアロジックに直接影響するのを防ぎます。
     */
    onGamePaused() {
        // UIStateContextのフラグを更新し、GaugeSystemやTurnSystemなどの進行を停止させます。
        this.uiStateContext.isPausedByModal = true;
    }

    /**
     * ゲームの再開を処理するハンドラ。
     */
    onGameResumed() {
        // UIStateContextのフラグを更新し、ゲームの進行を再開させます。
        this.uiStateContext.isPausedByModal = false;
    }

    _startInitialSelection() {
        // 1. ゲームフェーズを初期選択に変更
        this.battlePhaseContext.battlePhase = GamePhaseType.INITIAL_SELECTION;

        // 2. 全プレイヤーの状態をリセットし、行動選択可能な状態にする
        const players = this.world.getEntitiesWith(GameState, Gauge);
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            // 破壊されていないプレイヤーのみリセット
            if (gameState.state !== PlayerStateType.BROKEN) {
                gameState.state = PlayerStateType.READY_SELECT;
                gauge.value = gauge.max;
                gauge.speedMultiplier = 1.0; // 速度補正をリセット
                // 選択済みのアクションをリセット
                this.world.addComponent(id, new Action());
                // StateSystemのポーリングをなくすため、ここで直接キュー追加を要求
                this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: id });
            }
        });
    }

    onGameStartConfirmed() {
        if (this.battlePhaseContext.battlePhase !== GamePhaseType.IDLE) return;
        this._startInitialSelection();
    }

    onBattleStartCancelled() {
        this.world.emit(GameEvents.HIDE_MODAL);
        this._startInitialSelection();
    }



    onBattleStartConfirmed() {
        // フェーズをアニメーション待ちに変更し、モーダルの再表示を防ぐ
        this.battlePhaseContext.battlePhase = GamePhaseType.PRE_BATTLE_ANIMATION;

        // モーダルを閉じるイベントを発行
        this.world.emit(GameEvents.HIDE_MODAL);
        // アニメーション表示を要求
        this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
    }

    /**
     * 戦闘開始アニメーション完了時のハンドラ
     */
    onBattleAnimationCompleted() {
        // 1. フェーズをバトルに移行
        this.battlePhaseContext.battlePhase = GamePhaseType.BATTLE;
        
        // 2. 全プレイヤーのゲージをリセット
        this.world.getEntitiesWith(Gauge).forEach(id => {
            const gauge = this.world.getComponent(id, Gauge);
            if (gauge) gauge.value = 0;
        });
    }

    onPlayerBroken(detail) {
        // リーダーが破壊されたかどうかをチェックし、ゲームオーバー判定を行う
        // teamIdをペイロードから直接受け取る
        const { entityId, teamId } = detail;
        // 破壊されたエンティティがリーダーかどうかをPlayerInfoコンポーネントから確認する
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        // リーダー破壊、かつ、まだゲームオーバーになっていなければ処理
        if (playerInfo && playerInfo.isLeader && this.battlePhaseContext.battlePhase !== GamePhaseType.GAME_OVER) { // Use BattlePhaseContext
            // 敵チームを勝者とする
            const winningTeam = teamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            
            // 1. ゲームフェーズを終了に設定 (use BattlePhaseContext)
            this.battlePhaseContext.battlePhase = GamePhaseType.GAME_OVER;
            this.battlePhaseContext.winningTeam = winningTeam; // Use original GameContext for winning team result

            // 2. ゲームオーバーモーダルの表示を要求
            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
        }
    }

    update(deltaTime) {
        try {           
            // BATTLE_START_CONFIRMフェーズの処理を追加
            if (this.battlePhaseContext.battlePhase === GamePhaseType.BATTLE_START_CONFIRM) { // Use BattlePhaseContext
                // 全てのモーダルが閉じられたことを確認してから、バトル開始確認モーダルを表示
                if (!this.uiStateContext.isPausedByModal) { // Use UIStateContext
                    this.world.emit(GameEvents.SHOW_MODAL, { 
                        type: ModalType.BATTLE_START_CONFIRM,
                        data: {},
                        priority: 'high' // 高優先度で表示
                    });
                }
                return;
            }

            // 初期選択フェーズでのみ実行
            if (this.battlePhaseContext.battlePhase !== GamePhaseType.INITIAL_SELECTION) return; // Use BattlePhaseContext

            // 全プレイヤーが行動選択を終えたかチェック
            const allPlayers = this.world.getEntitiesWith(GameState);
            const allSelected = allPlayers.every(id => {
                const state = this.world.getComponent(id, GameState);
                // BROKEN状態も選択済みとみなす
                const unselectedStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                return !unselectedStates.includes(state.state);
            });

            // 全員が選択し終わったら、戦闘開始確認フェーズに移行
            if (allSelected) {
                this.battlePhaseContext.battlePhase = GamePhaseType.BATTLE_START_CONFIRM;
                // 即座にモーダルを表示するのではなく、次のフレームで処理
                // これにより、他のモーダルが閉じられるのを待つ
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'GameFlowSystem.update', deltaTime });
        }
    }
}