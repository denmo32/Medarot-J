/**
 * @file TurnStartState.js
 * @description ターン開始フェーズ。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase } from '../../../common/constants.js';
import { GameEvents } from '../../../../common/events.js';
import { ActionSelectionState } from './ActionSelectionState.js';

export class TurnStartState extends BaseState {
    enter() {
        this.battleContext.phase = BattlePhase.TURN_START;
        // TurnSystem等は毎フレーム動作しているため、特別な処理は不要。
        // 即座に次のフェーズへ移行するが、拡張性を考慮してステートとして残す。
    }

    update(deltaTime) {
        return new ActionSelectionState(this.system);
    }
}