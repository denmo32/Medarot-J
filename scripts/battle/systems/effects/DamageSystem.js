/**
 * @file DamageSystem.js
 * @description ダメージエフェクト処理システム。
 * パーツIDを使用してコンポーネントを操作する形に修正。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js';
import { ActiveEffects, IsGuarding } from '../../components/index.js';
import { PartStatus, PartEffects } from '../../components/parts/PartComponents.js'; // 追加
import { EffectType } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';
import { HpChangedEvent, PartBrokenEvent } from '../../../components/Events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { CombatParameterBuilder } from '../../services/CombatParameterBuilder.js';
import { QueryService } from '../../services/QueryService.js';

export class DamageSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            if (effect.type !== EffectType.DAMAGE) continue;

            this._processDamage(entityId, effect);
        }
    }

    _processDamage(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { sourceId, targetId, partKey, outcome, attackingPart } = context;

        let finalDamage = effect.value || 0;
        let isCritical = effect.isPenetration ? (effect.params?.isCritical || false) : outcome.isCritical;
        let isDefended = outcome.isDefended;

        // 計算フェーズ
        if (finalDamage === 0 && !effect.isPenetration) {
            const builder = new CombatParameterBuilder(this.world);
            const params = builder.buildDamageParams({
                sourceId, 
                targetId, 
                attackingPart, 
                outcome
            });
            
            finalDamage = CombatCalculator.calculateDamage(params);
        }

        // 適用フェーズ
        const targetPartsComponent = this.world.getComponent(targetId, Parts);
        if (!targetPartsComponent || targetPartsComponent[partKey] === null) {
            this._finishEffect(entityId, { value: 0 });
            return;
        }

        // パーツIDを取得
        const partEntityId = targetPartsComponent[partKey];
        // PartStatusコンポーネントを取得
        const partStatus = this.world.getComponent(partEntityId, PartStatus);

        if (!partStatus) {
            this._finishEffect(entityId, { value: 0 });
            return;
        }

        const oldHp = partStatus.hp;
        const newHp = Math.max(0, oldHp - finalDamage);
        const actualDamage = oldHp - newHp;
        
        // 状態更新
        partStatus.hp = newHp;
        
        let isPartBroken = false;
        let isGuardBroken = false;
        const stateUpdates = [];

        if (oldHp > 0 && newHp === 0) {
            isPartBroken = true;
            partStatus.isBroken = true;
            
            const partBrokenEventEntity = this.world.createEntity();
            this.world.addComponent(partBrokenEventEntity, new PartBrokenEvent({
                entityId: targetId,
                partKey
            }));

            if (partKey === PartInfo.HEAD.key) {
                // 頭部破壊時は頭部パーツのStatusも更新（今回はHeadそのものが対象だが、他の場所で参照してる場合のため）
                const headPartId = targetPartsComponent.head;
                const headStatus = this.world.getComponent(headPartId, PartStatus);
                if (headStatus) headStatus.isBroken = true;
                
                stateUpdates.push({ type: 'SetPlayerBroken', targetId });
            }

            // ガードブレイク判定
            const activeEffects = this.world.getComponent(targetId, ActiveEffects);
            const isGuarding = this.world.getComponent(targetId, IsGuarding);
            if (isGuarding && activeEffects) {
                const isGuardPart = activeEffects.effects.some(
                    e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey
                );
                if (isGuardPart) {
                    isGuardBroken = true;
                    stateUpdates.push({
                        type: 'ResetToCooldown',
                        targetId: targetId,
                        options: {}
                    });
                }
            }
        }

        const hpChangeEventEntity = this.world.createEntity();
        this.world.addComponent(hpChangeEventEntity, new HpChangedEvent({
            entityId: targetId,
            partKey,
            newHp,
            oldHp,
            maxHp: partStatus.maxHp,
            change: -actualDamage,
            isHeal: false
        }));

        // 貫通処理
        const overkillDamage = finalDamage - actualDamage;
        if (isPartBroken && overkillDamage > 0 && effect.penetrates) {
            // 頭部生存確認
            const headStatus = this.world.getComponent(targetPartsComponent.head, PartStatus);
            if (headStatus && !headStatus.isBroken) {
                const nextTargetPartKey = QueryService.findRandomPenetrationTarget(
                    this.world,
                    targetId,
                    partKey
                );

                if (nextTargetPartKey) {
                    const nextEffectEntity = this.world.createEntity();
                    this.world.addComponent(nextEffectEntity, new ApplyEffect({
                        type: EffectType.DAMAGE,
                        value: overkillDamage,
                        calculation: effect.calculation,
                        penetrates: true,
                        isPenetration: true,
                        params: { isCritical }
                    }));
                    this.world.addComponent(nextEffectEntity, new EffectContext({
                        sourceId,
                        targetId,
                        partKey: nextTargetPartKey,
                        parentId: context.parentId,
                        outcome,
                        attackingPart
                    }));
                }
            }
        }

        const resultData = {
            type: EffectType.DAMAGE,
            targetId,
            partKey,
            value: actualDamage,
            oldHp,
            newHp,
            isCritical,
            isDefended,
            isPartBroken,
            isGuardBroken,
            isPenetration: effect.isPenetration,
            overkillDamage,
            stateUpdates
        };

        this._finishEffect(entityId, resultData);
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}