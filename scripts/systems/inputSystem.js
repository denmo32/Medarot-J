// scripts/systems/inputSystem.js:

import { PlayerInfo, GameState, Parts } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType, TeamID } from '../constants.js';

export class InputSystem {
    constructor(world) {
        this.world = world;
        this.world.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
    }

    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const parts = this.world.getComponent(entityId, Parts);
        const attackableParts = [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM];
        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && attackableParts.includes(key));
        
        const modalData = {
            entityId: entityId,
            title: '行動選択',
            actorName: `${playerInfo.name} の番です。`,
            buttons: availableParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.action})`,
                partKey: partKey
            }))
        };

        this.world.emit(GameEvents.SHOW_MODAL, { type: 'selection', data: modalData });
    }

    update(deltaTime) {
        const gamePhase = this.world.gamePhase;

        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        if (gamePhase.activePlayer || gamePhase.isModalActive || !activePhases.includes(gamePhase.phase)) {
            return;
        }

        const selectablePlayer = this.world.getEntitiesWith(PlayerInfo, GameState)
            .find(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                
                if (!playerInfo || !gameState) return false;

                const currentTeamId = playerInfo.teamId.trim();
                const currentState = gameState.state.trim();

                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                return currentTeamId === TeamID.TEAM1 && selectableStates.includes(currentState);
            });

        // ★★★ 不具合修正：selectablePlayerが0の場合もtrueになるように修正 ★★★
        if (selectablePlayer !== undefined && selectablePlayer !== null) {
            const gameState = this.world.getComponent(selectablePlayer, GameState);
            gameState.state = PlayerStateType.READY_SELECT;

            gamePhase.activePlayer = selectablePlayer;

            this.world.emit(GameEvents.PLAYER_INPUT_REQUIRED, { entityId: selectablePlayer });
        }
    }
}