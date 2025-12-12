/**
 * @file PhaseContext.js
 * @description バトルフェーズの状態を保持するコンポーネント。
 */
import { BattlePhase } from '../common/constants.js';

export class PhaseContext {
    constructor() {
        this.phase = BattlePhase.IDLE; // constants.jsのBattlePhase.IDLEを初期値とする
    }
}