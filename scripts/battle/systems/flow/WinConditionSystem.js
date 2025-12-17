/**
 * @file WinConditionSystem.js
 * @description 勝敗判定を行うシステム。
 * イベント発行を整理し、BattleFlowStateによる状態管理へ完全移行。
 */
import { System } from '../../../../engine/core/System.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { TeamID } from '../../../common/constants.js';
import { BattlePhase } from '../../common/constants.js';
import { BattleFlowState, BattleSequenceState, SequencePending } from '../../components/index.js';
// import { GameEvents } from '../../../common/events.js'; // イベントシステム廃止につき削除

export class WinConditionSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);
    }

    update(deltaTime) {
        if (this.battleFlowState.phase === BattlePhase.GAME_OVER) {
            return;
        }

        // 判定を行うべきタイミングかチェック
        if (this.battleFlowState.phase !== BattlePhase.ACTION_EXECUTION &&
            this.battleFlowState.phase !== BattlePhase.TURN_END) {
            return;
        }

        if (this._isSequenceRunning()) {
            return;
        }

        this._checkWinCondition();
    }

    _isSequenceRunning() {
        const activeSequences = this.getEntities(BattleSequenceState);
        const pendingSequences = this.getEntities(SequencePending);
        return activeSequences.length > 0 || pendingSequences.length > 0;
    }

    _checkWinCondition() {
        const players = this.getEntities(PlayerInfo, Parts);
        let team1Alive = false;
        let team2Alive = false;
        let team1LeaderAlive = false;
        let team2LeaderAlive = false;

        for (const entityId of players) {
            const info = this.world.getComponent(entityId, PlayerInfo);
            const parts = this.world.getComponent(entityId, Parts);

            if (parts.head && !parts.head.isBroken) {
                if (info.teamId === TeamID.TEAM1) {
                    team1Alive = true;
                    if (info.isLeader) team1LeaderAlive = true;
                } else if (info.teamId === TeamID.TEAM2) {
                    team2Alive = true;
                    if (info.isLeader) team2LeaderAlive = true;
                }
            }
        }

        let winningTeam = null;

        if (!team1LeaderAlive || !team1Alive) {
            winningTeam = TeamID.TEAM2;
        } else if (!team2LeaderAlive || !team2Alive) {
            winningTeam = TeamID.TEAM1;
        }

        if (winningTeam) {
            this._triggerGameOver(winningTeam);
        }
    }

    _triggerGameOver(winningTeam) {
        // フェーズを更新 (GameFlowSystemがこれを検知する)
        this.battleFlowState.phase = BattlePhase.GAME_OVER;
        this.battleFlowState.winningTeam = winningTeam;

        // ログ出力用
        console.log(`Game Over! Winner: ${winningTeam}`);

        // GameEvents.GAME_OVER イベント発行は廃止 (BattleFlowStateの変更で十分)
    }
}