import { System } from '../../../../engine/core/System.js';
import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, EffectType } from '../../../config/constants.js';
import { snapToActionLine } from '../../utils/positionUtils.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
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