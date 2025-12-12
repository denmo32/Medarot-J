/**
 * @file BattleHistoryContext.js
 * @description 戦闘履歴の状態を保持するコンポーネント。
 */
import { TeamID } from '../../common/constants.js';

export class BattleHistoryContext {
    constructor() {
        this.history = {
            teamLastAttack: {
                [TeamID.TEAM1]: { targetId: null, partKey: null },
                [TeamID.TEAM2]: { targetId: null, partKey: null }
            },
            leaderLastAttackedBy: {
                [TeamID.TEAM1]: null,
                [TeamID.TEAM2]: null
            }
        };
    }
}