import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo } from '../../../components/index.js';
import { TeamID } from '../../../common/constants.js';
import { BattlePhase } from '../../common/constants.js';
import { PhaseState } from '../../components/PhaseState.js'; // 修正
import { TargetingService } from '../../services/TargetingService.js';

export class WinConditionSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState); // 修正
        this.brokenEventsQueue = [];

        this.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));

        // シーケンス完了時に判定を行う
        this.on(GameEvents.ACTION_SEQUENCE_COMPLETED, this.checkWinCondition.bind(this));
        // フェーズ終了時にも念のため
        this.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.checkWinCondition.bind(this));
    }

    onPlayerBroken(detail) {
        this.brokenEventsQueue.push(detail);
    }

    checkWinCondition() {
        if (this.phaseState.phase === BattlePhase.GAME_OVER) { // 修正
            return;
        }

        if (this.brokenEventsQueue.length === 0) {
            return;
        }

        // 溜まった破壊イベントを処理
        for (const detail of this.brokenEventsQueue) {
            const { entityId: brokenEntityId, teamId: losingTeamId } = detail;
            const brokenPlayerInfo = this.world.getComponent(brokenEntityId, PlayerInfo);

            let isGameOver = false;

            // リーダー破壊判定
            if (brokenPlayerInfo && brokenPlayerInfo.isLeader) {
                isGameOver = true;
            }

            // 全滅判定
            const remainingAllies = TargetingService.getValidAllies(this.world, brokenEntityId, true);
            if (remainingAllies.length === 0) {
                isGameOver = true;
            }

            if (isGameOver) {
                const winningTeam = losingTeamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
                this.world.emit(GameEvents.GAME_OVER, { winningTeam });
                // 一度ゲームオーバーになったら以降の判定は不要
                this.brokenEventsQueue = [];
                return;
            }
        }

        // 処理済みイベントをクリア
        this.brokenEventsQueue = [];
    }
}