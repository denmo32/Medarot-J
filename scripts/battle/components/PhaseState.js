/**
 * @file PhaseState.js
 * @description バトルフェーズの状態を保持するコンポーネント。
 * 旧 PhaseContext を代替し、状態としての役割を明確化。
 */
import { BattlePhase } from '../common/constants.js';

export class PhaseState {
    constructor() {
        /** @type {string} 現在のフェーズ (BattlePhase enum) */
        this.phase = BattlePhase.IDLE;
    }
}