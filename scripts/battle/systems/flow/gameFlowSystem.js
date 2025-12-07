import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../components/BattleContext.js'; // 修正
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, ModalType } from '../../common/constants.js';
import { Timer } from '../../../../engine/stdlib/components/Timer.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
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