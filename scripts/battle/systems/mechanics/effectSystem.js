import { System } from '../../../../engine/core/System.js';
import { ActiveEffects, GameState } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { EffectType } from '../../../common/constants.js';
import { CooldownService } from '../../services/CooldownService.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.TURN_END, this.onTurnEnd.bind(this));
    }

    onTurnEnd(detail) {
        const allEntities = this.getEntities(ActiveEffects);
        allEntities.forEach(id => this._updateEffectsForEntity(id));
    }

    _updateEffectsForEntity(entityId) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        if (!activeEffects || activeEffects.effects.length === 0) {
            return;
        }

        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            if (effect.duration > 0) {
                effect.duration--;
            }

            if (effect.duration === undefined || effect.duration > 0 || effect.duration === Infinity) {
                nextEffects.push(effect);
            } else {
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect });
                
                const gameState = this.world.getComponent(entityId, GameState);
                if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
                    // ガード効果切れの際、クールダウンへ戻す (Service直接呼び出し)
                    CooldownService.resetEntityStateToCooldown(this.world, entityId, {});
                }
            }
        }

        activeEffects.effects = nextEffects;
    }
}