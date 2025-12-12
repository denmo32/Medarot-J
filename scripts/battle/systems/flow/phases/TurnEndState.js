/**
 * @file TurnEndState.js
 * @description ターン終了フェーズ。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase } from '../../../common/constants.js';
import { GameEvents } from '../../../../common/events.js';
import { TurnStartState } from './TurnStartState.js';

export class TurnEndState extends BaseState {
    enter() {
        this.phaseContext.phase = BattlePhase.TURN_END;

        this.turnContext.number++;

        // ターン終了イベント発行 (EffectSystemなどがリッスン)
        this.world.emit(GameEvents.TURN_END, { turnNumber: this.turnContext.number - 1 });

        // ターン開始イベント発行
        this.world.emit(GameEvents.TURN_START, { turnNumber: this.turnContext.number });
    }

    update(deltaTime) {
        // 次のターンへ
        return new TurnStartState(this.system);
    }
}