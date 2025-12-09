/**
 * @file BattleContext.js
 * @description バトルシーン全体の進行状態を保持するシングルトンコンポーネント。
 */
import { BattlePhase } from '../common/constants.js';
import { TeamID } from '../../common/constants.js';
import { HookRegistry } from '../definitions/HookRegistry.js';

export class BattleContext {
    constructor() {
        this.phase = BattlePhase.IDLE;
        this.gameMode = 'battle';
        this.isPaused = false;
        
        // アクションシーケンス（タスク）実行中フラグ
        this.isSequenceRunning = false;

        this.turn = {
            number: 0,
            currentActorId: null,
            actionQueue: [],
            selectedActions: new Map(),
        };

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

        this.winningTeam = null;

        // フックレジストリ（処理介入用）
        this.hookRegistry = new HookRegistry();
    }
}