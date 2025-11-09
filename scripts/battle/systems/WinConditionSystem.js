/**
 * @file 勝利条件判定システム
 * @description 戦闘の勝利・敗北条件を判定し、ゲーム終了イベントを発行する責務を持ちます。
 * GameFlowSystemからロジックを分離することで、勝利条件の追加・変更を容易にします。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { PlayerInfo, Parts } from '../core/components/index.js';
import { TeamID, BattlePhase } from '../common/constants.js';
import { BattleContext } from '../core/index.js';
import { getValidAllies } from '../utils/queryUtils.js';

export class WinConditionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
    }

    /**
     * プレイヤーが破壊されたイベントを購読し、勝利条件をチェックします。
     * @param {object} detail - PLAYER_BROKEN イベントのペイロード { entityId, teamId }
     */
    onPlayerBroken(detail) {
        // ゲームが既に終了している場合は何もしない
        if (this.battleContext.phase === BattlePhase.GAME_OVER) {
            return;
        }

        const { entityId: brokenEntityId, teamId: losingTeamId } = detail;
        const brokenPlayerInfo = this.world.getComponent(brokenEntityId, PlayerInfo);

        let isGameOver = false;
        // 条件1: 破壊されたのがリーダー機だった場合
        if (brokenPlayerInfo && brokenPlayerInfo.isLeader) {
            isGameOver = true;
        }

        // 条件2: チームの生存者がいなくなった場合 (リーダー撃破で即終了しないルールの場合に備える)
        const remainingAllies = getValidAllies(this.world, brokenEntityId, true);
        if (remainingAllies.length === 0) {
            isGameOver = true;
        }

        if (isGameOver) {
            const winningTeam = losingTeamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            // GameFlowSystemにゲーム終了を通知
            this.world.emit(GameEvents.GAME_OVER, { winningTeam });
        }
    }

    update(deltaTime) {
        // このシステムはイベント駆動のため、update処理は不要です。
    }
}