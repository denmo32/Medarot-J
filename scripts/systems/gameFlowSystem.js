// scripts/systems/gameFlowSystem.js:

import { GameContext, GameState, Gauge, PlayerInfo } from '../components.js';
import { GameEvents } from '../events.js';
import { GamePhaseType, PlayerStateType, TeamID } from '../constants.js';

/**
 * ゲーム全体のフロー（開始、戦闘、終了、リセット）を管理するシステム。
 * ゲームのグローバルな状態(GameContext)を唯一変更する責務を持つ。
 */
export class GameFlowSystem {
    constructor(world) {
        this.world = world;
        // ワールドに存在する唯一のGameContextコンポーネントへの参照を保持します。
        // これにより、毎フレーム検索する必要がなくなります。
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // ★変更: ゲーム開始のトリガーを、確認モーダルで「はい」が押されたイベントに変更
        this.world.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, this.onActionExecutionConfirmed.bind(this));
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.SHOW_MODAL, this.onShowModal.bind(this));
        this.world.on(GameEvents.HIDE_MODAL, this.onHideModal.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
    }

    // ★変更: メソッド名をイベントに合わせて変更
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
    
    onActionExecutionConfirmed(detail) {
        // 攻撃実行が確定したら、アクティブプレイヤーを解除
        this.context.activePlayer = null;
        // モーダルを閉じるイベントを発行
        this.world.emit(GameEvents.HIDE_MODAL);
    }

    onActionSelected(detail) {
        // 行動が選択されたら、アクティブプレイヤーを解除
        if (this.context.activePlayer === detail.entityId) {
            this.context.activePlayer = null;
        }
        // モーダルを閉じるイベントを発行
        this.world.emit(GameEvents.HIDE_MODAL);
    }

    onShowModal(detail) {
        // ★変更: isModalActiveの代わりにisPausedByModalフラグを立て、UI起因のゲーム停止を通知
        this.context.isPausedByModal = true;
        // 行動選択または実行のモーダルの場合、誰がアクティブかを記録
        if (detail.type === 'selection') {
            this.context.activePlayer = detail.data.entityId;
        } else if (detail.type === 'execution') {
            // ActionSystemから渡された攻撃実行者をactivePlayerとして設定
            this.context.activePlayer = detail.data.entityId;
        }
    }

    onHideModal() {
        // ★変更: isPausedByModalフラグを解除し、UI起因のゲーム停止を解除
        this.context.isPausedByModal = false;
    }

    onPlayerBroken(detail) {
        // リーダーが破壊されたかどうかをチェックし、ゲームオーバー判定を行う
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        // リーダー破壊、かつ、まだゲームオーバーになっていなければ処理
        if (playerInfo.isLeader && this.context.phase !== GamePhaseType.GAME_OVER) {
            // 敵チームを勝者とする
            const winningTeam = playerInfo.teamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            
            // 1. ゲームフェーズを終了に設定
            this.context.phase = GamePhaseType.GAME_OVER;
            this.context.winningTeam = winningTeam;

            // 2. ゲームオーバーモーダルの表示を要求
            this.world.emit(GameEvents.SHOW_MODAL, { type: 'game_over', data: { winningTeam } });
        }
    }

    update(deltaTime) {
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
            this.world.emit(GameEvents.SHOW_MODAL, { type: 'battle_start_confirm' });
        }
    }
}
