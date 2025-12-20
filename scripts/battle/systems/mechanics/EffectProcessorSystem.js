/**
 * @file EffectProcessorSystem.js
 * @description エフェクト処理の統合システム。
 * ApplyEffectコンポーネントを持つエンティティに対して、
 * EffectRegistryから取得した適切なHandlerを実行する。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';

export class EffectProcessorSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            const context = this.world.getComponent(entityId, EffectContext);
            
            const handler = EffectRegistry.get(effect.type);
            
            if (handler) {
                handler.apply(this.world, entityId, effect, context);
            } else {
                console.warn(`EffectProcessorSystem: No handler found for effect type '${effect.type}'`);
                // ハンドラがない場合はとりあえず完了扱いにしてスタックを防ぐ
                this.world.removeComponent(entityId, ApplyEffect);
            }
        }
    }
}