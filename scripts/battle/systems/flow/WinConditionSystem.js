import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo } from '../../components/index.js';
import { TeamID, BattlePhase } from '../../../config/constants.js';
import { BattleContext } from '../../context/index.js';
import { getValidAllies } from '../../utils/queryUtils.js';

export class WinConditionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
    }

    onPlayerBroken(detail) {
        if (this.battleContext.phase === BattlePhase.GAME_OVER) {
            return;
        }

        const { entityId: brokenEntityId, teamId: losingTeamId } = detail;
        const brokenPlayerInfo = this.world.getComponent(brokenEntityId, PlayerInfo);

        let isGameOver = false;
        if (brokenPlayerInfo && brokenPlayerInfo.isLeader) {
            isGameOver = true;
        }

        const remainingAllies = getValidAllies(this.world, brokenEntityId, true);
        if (remainingAllies.length === 0) {
            isGameOver = true;
        }

        if (isGameOver) {
            const winningTeam = losingTeamId === TeamID.TEAM1 ? TeamID.TEAM2 : TeamID.TEAM1;
            this.world.emit(GameEvents.GAME_OVER, { winningTeam });
        }
    }
}