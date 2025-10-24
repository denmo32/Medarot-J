import { BaseSystem } from '../../core/baseSystem.js';
import { GameState, Gauge, PlayerInfo, Action } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { GameEvents } from '../common/events.js';
import { BattlePhase, PlayerStateType, TeamID, ModalType } from '../common/constants.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { Timer } from '../../core/components/Timer.js';

/**
 * ゲーム全体のフロー（開始、戦闘、終了、リセット）を管理するシステム。
 */
export class GameFlowSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.world.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.world.on(GameEvents.BATTLE_START_CANCELLED, this.onBattleStartCancelled.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        this.world.on(GameEvents.GAME_PAUSED, this.onGamePaused.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onGameResumed.bind(this));
    }

    onGamePaused() {
        this.battleContext.isPaused = true;
    }

    onGameResumed() {
        this.battleContext.isPaused = false;
    }

    _startInitialSelection() {
        this.battleContext.phase = BattlePhase.INITIAL_SELECTION;

        const players = this.world.getEntitiesWith(GameState, Gauge);
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            if (gauge) gauge.value = 0;

            if (gameState.state !== PlayerStateType.BROKEN) {
                gameState.state = PlayerStateType.READY_SELECT;
                gauge.value = gauge.max;
                gauge.speedMultiplier = 1.0;
                this.world.addComponent(id, new Action());
                this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: id });
            }
        });
    }

    onGameStartConfirmed() {
        if (this.battleContext.phase !== BattlePhase.IDLE) return;
        this._startInitialSelection();
    }

    onBattleStartCancelled() {
        this.battleContext.isPaused = false;
        this.world.emit(GameEvents.HIDE_MODAL);
        this._startInitialSelection();
    }

    onBattleStartConfirmed() {
        this.battleContext.isPaused = false;
        this.battleContext.phase = BattlePhase.BATTLE_START;
        this.world.emit(GameEvents.HIDE_MODAL);
        this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
    }

    onPlayerBroken(detail) {
        const { entityId, teamId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        if (playerInfo && playerInfo.isLeader && this.battleContext.phase !== BattlePhase.GAME_OVER) {
            const winningTeam = teamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            
            this.battleContext.phase = BattlePhase.GAME_OVER;
            this.battleContext.winningTeam = winningTeam;

            // setTimeoutを廃止し、ECSベースのTimerに置き換える
            // 3秒後にシーン遷移を要求するタイマーエンティティを作成
            const timerEntity = this.world.createEntity();
            this.world.addComponent(timerEntity, new Timer(3000, () => {
                // BattleSceneがこのイベントを購読し、シーン遷移を実行する
                this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                    sceneName: 'map',
                    // BattleScene側でGameDataManagerを取得するため、ここではデータを渡さない
                    data: { result: { winningTeam } } 
                });
            }));

            // ゲームオーバーモーダルはタイマーとは独立してすぐに表示
            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
        }
    }

    update(deltaTime) {
    }
}