// scripts/systems/gameFlowSystem.js:

import { GameContext, GameState, Gauge, PlayerInfo } from '../core/components.js';
import { GameEvents } from '../common/events.js';
import { GamePhaseType, PlayerStateType, TeamID, ModalType } from '../common/constants.js';

/**
 * ゲーム全体のフロー（開始、戦闘、終了、リセット）を管理するシステム。
 * ゲームのグローバルな状態(GameContext)を唯一変更する責務を持つ。
 */
export class GameFlowSystem {
    constructor(world) {
        this.world = world;
        // ワールドに存在する唯一のGameContextコンポーネントへの参照を保持します。
        // これにより、毎フレーム検索する必要がなくなります。
        this.context = this.world.getSingletonComponent(GameContext);

        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.world.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        // ★新規: UIからのゲーム一時停止/再開イベントを購読し、ゲーム全体のポーズ状態を一元管理します。
        this.world.on(GameEvents.GAME_PAUSED, this.onGamePaused.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onGameResumed.bind(this));
    }

    /**
     * ★新規: ゲームの一時停止を処理するハンドラ。
     * ViewSystemから発行されたイベントを受け、GameContextのフラグを更新します。
     * これにより、UIの都合によるゲーム停止が、コアロジックに直接影響するのを防ぎます。
     */
    onGamePaused() {
        // GameContextのフラグを更新し、GaugeSystemやTurnSystemなどの進行を停止させます。
        this.context.isPausedByModal = true;
    }

    /**
     * ★新規: ゲームの再開を処理するハンドラ。
     */
    onGameResumed() {
        // GameContextのフラグを更新し、ゲームの進行を再開させます。
        this.context.isPausedByModal = false;
    }

    onGameStartConfirmed() {
        if (this.context.phase !== GamePhaseType.IDLE) return;

        // 1. ゲームフェーズを初期選択に変更
        this.context.phase = GamePhaseType.INITIAL_SELECTION;

        // 2. 全プレイヤーを準備完了状態にし、ゲージを最大にする
        const players = this.world.getEntitiesWith(GameState, Gauge);
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            gameState.state = PlayerStateType.READY_SELECT;
            gauge.value = gauge.max;
        });
    }

    onBattleStartConfirmed() {
        // 1. フェーズをバトルに移行
        this.context.phase = GamePhaseType.BATTLE;
        
        // 2. 全プレイヤーのゲージをリセット
        this.world.getEntitiesWith(Gauge).forEach(id => {
            const gauge = this.world.getComponent(id, Gauge);
            if (gauge) gauge.value = 0;
        });

        // 3. モーダルを閉じるイベントを発行
        this.world.emit(GameEvents.HIDE_MODAL);
    }

    onPlayerBroken(detail) {
        // リーダーが破壊されたかどうかをチェックし、ゲームオーバー判定を行う
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        // リーダー破壊、かつ、まだゲームオーバーになっていなければ処理
        if (playerInfo && playerInfo.isLeader && this.context.phase !== GamePhaseType.GAME_OVER) {
            // 敵チームを勝者とする
            const winningTeam = playerInfo.teamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            
            // 1. ゲームフェーズを終了に設定
            this.context.phase = GamePhaseType.GAME_OVER;
            this.context.winningTeam = winningTeam;

            // 2. ゲームオーバーモーダルの表示を要求
            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
        }
    }

    update(deltaTime) {
        // ★新規: メッセージキューの処理
        // ゲームがポーズされておらず、かつキューに表示待ちのメッセージがある場合にモーダルを表示します。
        // これにより、モーダル表示の競合を防ぎ、安全なタイミングでメッセージを処理します。
        if (!this.context.isPausedByModal && this.context.messageQueue && this.context.messageQueue.length > 0) {
            const message = this.context.messageQueue.shift();
            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.MESSAGE, data: { message } });
            return; // メッセージ表示を要求したら、このフレームの他の処理はスキップ
        }

        // ★修正: BATTLE_START_CONFIRMフェーズの処理を追加
        if (this.context.phase === GamePhaseType.BATTLE_START_CONFIRM) {
            // 全てのモーダルが閉じられたことを確認してから、バトル開始確認モーダルを表示
            if (!this.context.isPausedByModal) {
                this.world.emit(GameEvents.SHOW_MODAL, { 
                    type: ModalType.BATTLE_START_CONFIRM,
                    data: {},
                    priority: 'high' // ★追加: 高優先度で表示
                });
            }
            return;
        }

        // 初期選択フェーズでのみ実行
        if (this.context.phase !== GamePhaseType.INITIAL_SELECTION) return;

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
            this.context.phase = GamePhaseType.BATTLE_START_CONFIRM;
            // ★修正: 即座にモーダルを表示するのではなく、次のフレームで処理
            // これにより、他のモーダルが閉じられるのを待つ
        }
    }
}