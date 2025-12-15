/**
 * @file BattleFlowState.js
 * @description バトルの全体的な進行状態（フェーズ、ターン、結果など）を管理するコンポーネント。
 * PhaseState, TurnContext, BattleResult の機能を集約し、ゲームフローの状態を一元管理します。
 */

import { BattlePhase } from '../common/constants.js';
import { TeamID } from '../../common/constants.js';

export class BattleFlowState {
    constructor() {
        // フェーズ状態
        this.phase = BattlePhase.IDLE;

        // ターン情報
        this.turnNumber = 0;
        this.currentActorId = null;

        // 勝敗情報
        this.winningTeam = null; // TeamID または null

        // その他の世界全体の状態があればここに追加
    }
}