import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { CONFIG } from '../../common/config.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, ModalType, BattlePhase, TeamID, EffectType, EffectScope, PartInfo, TargetTiming, ActionCancelReason } from '../../common/constants.js';
import { isValidTarget } from '../../utils/queryUtils.js';
import { snapToActionLine } from '../../utils/positionUtils.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';
import { ErrorHandler } from '../../../../engine/utils/ErrorHandler.js';

export class StateSystem {
    constructor(world) {
        this.world = world;
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }
    
    onHpBarAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            if (effect.isPlayerBroken) {
                const { targetId: entityId } = effect;
                const gameState = this.world.getComponent(entityId, GameState);
                const gauge = this.world.getComponent(entityId, Gauge);

                if (gameState) {
                    gameState.state = PlayerStateType.BROKEN;
                }
                if (gauge) {
                    gauge.value = 0;
                }
                this.world.addComponent(entityId, new Action());

                const playerInfo = this.world.getComponent(entityId, PlayerInfo);
                if (playerInfo) {
                    this.world.emit(GameEvents.PLAYER_BROKEN, { entityId, teamId: playerInfo.teamId });
                }
            }
        }
    }

    onCombatSequenceResolved(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            if (effect.type === EffectType.APPLY_GUARD) {
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    snapToActionLine(this.world, attackerId);
                }
            }
        }
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;
            snapToActionLine(this.world, entityId);
        }
    }
    
    update(deltaTime) {
    }
}