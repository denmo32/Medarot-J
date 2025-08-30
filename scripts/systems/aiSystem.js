// scripts/systems/aiSystem.js:

import { PlayerInfo, GameState, Parts, Action } from '../components.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID } from '../constants.js';
import { GameEvents } from '../events.js';

export class AiSystem {
    constructor(world) {
        this.world = world;
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    onAiActionRequired(detail) {
        const { entityId } = detail;
        const parts = this.world.getComponent(entityId, Parts);

        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM].includes(key));

        if (availableParts.length > 0) {
            const [partKey, part] = this.chooseAction(entityId, availableParts);
            // 状態を変更せず、ACTION_SELECTEDイベントを発行する
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey });
        } else {
            // 攻撃パーツがない場合、StateSystemに状態変更を委ねるためBROKENイベントを発行
            // (StateSystem側で頭部破壊時にBROKENになる処理があるが、念のため)
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    chooseAction(entityId, availableParts) {
        // TODO: もっと賢いロジックに
        return availableParts[0];
    }

    update(deltaTime) {
        const gamePhase = this.world.gamePhase;

        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        if (gamePhase.activePlayer || gamePhase.isModalActive || !activePhases.includes(gamePhase.phase)) {
            return;
        }

        const cpuEntities = this.world.getEntitiesWith(PlayerInfo, GameState)
            .filter(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                return playerInfo.teamId === TeamID.TEAM2 && selectableStates.includes(gameState.state);
            });

        for (const entityId of cpuEntities) {
            const gameState = this.world.getComponent(entityId, GameState);
            gameState.state = PlayerStateType.READY_SELECT;
            
            // このAIに行動を要求するイベントを発行
            this.world.emit(GameEvents.AI_ACTION_REQUIRED, { entityId });
        }
    }
}
