/**
 * @file DamageSystem.js
 * @description ダメージエフェクトを処理するシステム。
 * ApplyEffect(type=DAMAGE)を持つエンティティを処理し、HPを減算する。
 * 貫通（Penetration）処理もここで行う。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { ActiveEffects, IsGuarding } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js'; // パスを修正 (../../ -> ../../../)
import { HpChangedEvent, PartBrokenEvent } from '../../../components/Events.js'; // GameEventsの代わりに新しいイベントコンポーネントをインポート
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';
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

        // 計算フェーズ
        // エフェクトエンティティ生成時に基本情報はあるが、実際のダメージ値はここで計算する
        // (貫通エフェクトの場合は固定値が入っている場合もある)
        
        let finalDamage = effect.value || 0;
        let isCritical = effect.isPenetration ? (effect.params?.isCritical || false) : outcome.isCritical;
        let isDefended = outcome.isDefended;

        // 通常攻撃（非貫通由来）の場合は計算が必要
        if (finalDamage === 0 && !effect.isPenetration) {
            const targetParts = this.world.getComponent(targetId, Parts);
            const sourceParts = this.world.getComponent(sourceId, Parts); // 攻撃者の脚部用
            
            if (!targetParts || !sourceParts) {
                this._finishEffect(entityId, { value: 0 });
                return;
            }

            const calcParams = effect.calculation || {};
            const baseStatKey = calcParams.baseStat || 'success';
            const powerStatKey = calcParams.powerStat || 'might';
            const defenseStatKey = calcParams.defenseStat || 'armor';

            const effectiveBaseVal = EffectService.getStatModifier(this.world, sourceId, baseStatKey, { 
                attackingPart, 
                attackerLegs: sourceParts.legs 
            }) + (attackingPart[baseStatKey] || 0);

            const effectivePowerVal = EffectService.getStatModifier(this.world, sourceId, powerStatKey, { 
                attackingPart, 
                attackerLegs: sourceParts.legs 
            }) + (attackingPart[powerStatKey] || 0);

            const mobility = targetParts.legs?.mobility || 0;
            const defenseBase = targetParts.legs?.[defenseStatKey] || 0;
            const stabilityDefenseBonus = Math.floor((targetParts.legs?.stability || 0) / 2);
            const totalDefense = defenseBase + stabilityDefenseBonus;

            finalDamage = CombatCalculator.calculateDamage({
                effectiveBaseVal,
                effectivePowerVal,
                mobility,
                totalDefense,
                isCritical: isCritical,
                isDefenseBypassed: !isCritical && isDefended
            });
        }

        // 適用フェーズ
        const targetPartsComponent = this.world.getComponent(targetId, Parts);
        if (!targetPartsComponent || !targetPartsComponent[partKey]) {
            this._finishEffect(entityId, { value: 0 });
            return;
        }

        const part = targetPartsComponent[partKey];
        const oldHp = part.hp;
        const newHp = Math.max(0, oldHp - finalDamage);
        const actualDamage = oldHp - newHp;
        
        // 状態更新
        part.hp = newHp;
        
        let isPartBroken = false;
        let isGuardBroken = false;
        const stateUpdates = [];
        // const events = []; // 古いイベント通知用の配列、削除

        if (oldHp > 0 && newHp === 0) {
            isPartBroken = true;
            part.isBroken = true;
            
            // パーツ破壊をUIやログ用に通知（イベントコンポーネントとして追加）
            const partBrokenEventEntity = this.world.createEntity();
            this.world.addComponent(partBrokenEventEntity, new PartBrokenEvent({
                entityId: targetId,
                partKey
            }));

            if (partKey === PartInfo.HEAD.key) {
                targetPartsComponent.head.isBroken = true; // 明示的
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

        // HP変更をUIやログ用に通知（イベントコンポーネントとして追加）
        const hpChangeEventEntity = this.world.createEntity();
        this.world.addComponent(hpChangeEventEntity, new HpChangedEvent({
            entityId: targetId,
            partKey,
            newHp,
            oldHp,
            maxHp: part.maxHp,
            change: -actualDamage,
            isHeal: false
        }));

        // 貫通処理
        const overkillDamage = finalDamage - actualDamage;
        if (isPartBroken && overkillDamage > 0 && effect.penetrates) {
            // ターゲットがまだ生きている（頭部が生きてる）場合のみ貫通
            if (!targetPartsComponent.head.isBroken) {
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
                        params: { isCritical } // クリティカル状態を継承
                    }));
                    this.world.addComponent(nextEffectEntity, new EffectContext({
                        sourceId,
                        targetId,
                        partKey: nextTargetPartKey,
                        parentId: context.parentId, // 親アクションIDを継承
                        outcome,
                        attackingPart
                    }));
                }
            }
        }

        // 結果書き込みとApplyEffect削除
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