import { System } from '../../../../engine/core/System.js';
import { BattleStateContext } from '../../components/BattleStateContext.js';
import { GameEvents } from '../../../common/events.js';

export class GameFlowSystem extends System {
    constructor(world) {
        super(world);
        this.battleStateContext = this.world.getSingletonComponent(BattleStateContext);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // GAME_OVER は PhaseSystem が直接処理するようになったため、ここでは監視しないか、
        // ログ出力などの補助的な処理のみ行う。
        // this.on(GameEvents.GAME_OVER, this.onGameOver.bind(this));

        this.on(GameEvents.GAME_PAUSED, this.onGamePaused.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onGameResumed.bind(this));
    }

    onGamePaused() {
        this.battleStateContext.isPaused = true;
    }

    onGameResumed() {
        this.battleStateContext.isPaused = false;
    }
}