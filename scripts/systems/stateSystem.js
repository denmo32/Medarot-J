// scripts/systems/stateSystem.js:

import { Gauge, GameState, Parts, PlayerInfo, Action, Attack } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType } from '../constants.js';

export class StateSystem {
    constructor(world) {
        this.world = world;
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    onActionSelected(detail) {
        const { entityId, partKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        action.partKey = partKey;
        action.type = parts[partKey].action;
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        gauge.value = 0;
        
        this.world.emit(GameEvents.HIDE_MODAL);
        
        if (this.world.gamePhase.activePlayer === entityId) {
            this.world.gamePhase.activePlayer = null;
        }
    }

    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey, damage, isPartBroken, isPlayerBroken } = detail;

        // 1. ダメージ適用と破壊判定
        const targetParts = this.world.getComponent(targetId, Parts);
        const part = targetParts[targetPartKey];
        part.hp = Math.max(0, part.hp - damage);

        if (isPartBroken) {
            part.isBroken = true;
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: targetPartKey });
        }

        if (isPlayerBroken) {
            const gameState = this.world.getComponent(targetId, GameState);
            gameState.state = PlayerStateType.BROKEN;
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId });

            const playerInfo = this.world.getComponent(targetId, PlayerInfo);
            if (playerInfo.isLeader) {
                if (this.world.gamePhase.phase === GamePhaseType.GAME_OVER) return;

                this.world.gamePhase.phase = GamePhaseType.GAME_OVER;
                const winningTeam = this.world.getComponent(attackerId, PlayerInfo).teamId;
                this.world.emit(GameEvents.SHOW_MODAL, { type: 'game_over', data: { winningTeam } });
            }
        }

        // 2. 行動完了者の状態リセット
        const attackerGameState = this.world.getComponent(attackerId, GameState);
        const attackerGauge = this.world.getComponent(attackerId, Gauge);
        const attackerAction = this.world.getComponent(attackerId, Action);
        const attackerAttack = this.world.getComponent(attackerId, Attack);

        attackerGameState.state = PlayerStateType.CHARGING;
        attackerGauge.value = 0;
        attackerAction.partKey = null;
        attackerAction.type = null;
        attackerAttack.target = null;
        attackerAttack.partKey = null;
        attackerAttack.damage = 0;
        
        this.world.gamePhase.activePlayer = null;
    }

    update(deltaTime) {
        const gamePhase = this.world.gamePhase;
        const entities = this.world.getEntitiesWith(Gauge, GameState, Parts);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

            if (parts.head.isBroken && gameState.state !== PlayerStateType.BROKEN) {
                gameState.state = PlayerStateType.BROKEN;
                gauge.value = 0;
                this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
                continue; 
            }

            if (gauge.value >= gauge.max) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    gameState.state = PlayerStateType.READY_EXECUTE;
                }
            }
        }

        if (gamePhase.phase === GamePhaseType.INITIAL_SELECTION) {
            const allPlayers = this.world.getEntitiesWith(GameState);
            const allSelected = allPlayers.every(id => {
                const state = this.world.getComponent(id, GameState);
                return state.state !== PlayerStateType.READY_SELECT && state.state !== PlayerStateType.COOLDOWN_COMPLETE;
            });

            if (allSelected) {
                gamePhase.phase = GamePhaseType.BATTLE_START_CONFIRM;
                this.world.emit(GameEvents.SHOW_MODAL, { type: 'battle_start_confirm' });
            }
        }
    }
}
