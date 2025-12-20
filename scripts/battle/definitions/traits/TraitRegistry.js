/**
 * @file TraitRegistry.js
 * @description Traitロジックの管理クラス。
 */
import { GuardTrait } from '../../logic/traits/GuardTrait.js';
import { PenetrateTrait } from '../../logic/traits/PenetrateTrait.js';
import { StatModifierTrait } from '../../logic/traits/StatModifierTrait.js';

class TraitRegistryImpl {
    constructor() {
        this.traits = new Map();
    }

    initialize() {
        this.register('GUARD', new GuardTrait());
        this.register('PENETRATE', new PenetrateTrait());
        this.register('STAT_MODIFIER', new StatModifierTrait());
    }

    register(key, traitInstance) {
        this.traits.set(key, traitInstance);
    }

    get(key) {
        return this.traits.get(key);
    }

    executeTraitLogic(traitKey, hookPhase, context) {
        const trait = this.get(traitKey);
        if (trait && typeof trait[hookPhase] === 'function') {
            return trait[hookPhase](context);
        }
    }
}

export const TraitRegistry = new TraitRegistryImpl();