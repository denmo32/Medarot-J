import { System } from '../../../../engine/core/System.js';
import { GameState, Gauge, Action } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType, ModalType } from '../../../config/constants.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.on(GameEvents.BATTLE_START_CANCELLED, this.onBattleStartCancelled.bind(this));
        this.on(GameEvents.GAME_OVER, this.onGameOver.bind(this));
        this.on(GameEvents.GAME_PAUSED, this.onGamePaused.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onGameResumed.bind(this));
    }

    onGamePaused() {
        this.battleContext.isPaused = true;
    }

    onGameResumed() {
        this.battleContext.isPaused = false;
    }

    _startInitialSelection() {
        this.battleContext.phase = BattlePhase.INITIAL_SELECTION;

        const players = this.getEntities(GameState, Gauge);
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

    onGameOver(detail) {
        const { winningTeam } = detail;

        if (this.battleContext.phase !== BattlePhase.GAME_OVER) {
            this.battleContext.phase = BattlePhase.GAME_OVER;
            this.battleContext.winningTeam = winningTeam;

            const timerEntity = this.world.createEntity();
            this.world.addComponent(timerEntity, new Timer(3000, () => {
                this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                    sceneName: 'map',
                    data: { result: { winningTeam } } 
                });
            }));

            this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam } });
        }
    }
}