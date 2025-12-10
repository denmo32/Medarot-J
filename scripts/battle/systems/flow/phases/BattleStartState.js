/**
 * @file BattleStartState.js
 * @description バトル開始演出フェーズ。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase, PlayerStateType } from '../../../common/constants.js';
import { GameState } from '../../../components/index.js';
import { GameEvents } from '../../../../common/events.js';
import { TurnStartState } from './TurnStartState.js';

export class BattleStartState extends BaseState {
    constructor(system) {
        super(system);
        this._isAnimationCompleted = false;
        this._onAnimationCompleted = this._onAnimationCompleted.bind(this);
    }

    enter() {
        this.battleContext.phase = BattlePhase.BATTLE_START;
        this.world.on('BATTLE_ANIMATION_COMPLETED', this._onAnimationCompleted);
        this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
    }

    update(deltaTime) {
        if (this._isAnimationCompleted) {
            return new TurnStartState(this.system);
        }
        return null;
    }

    exit() {
        this.world.off('BATTLE_ANIMATION_COMPLETED', this._onAnimationCompleted);
        
        // ゲージリセット
        const players = this.system.getEntities(GameState);
        const commands = players.map(id => ({
            type: 'UPDATE_COMPONENT',
            targetId: id,
            componentType: 'Gauge',
            updates: { value: 0 }
        }));
        if (commands.length > 0) {
            this.world.emit(GameEvents.EXECUTE_COMMANDS, commands);
        }
    }

    _onAnimationCompleted() {
        this._isAnimationCompleted = true;
    }
}