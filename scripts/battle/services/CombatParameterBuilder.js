/**
 * @file CombatParameterBuilder.js
 * @description 戦闘計算に必要なパラメータオブジェクトを構築するサービス。
 * CombatContextからIDを取り出し、パーツエンティティから最新のコンポーネント値を取得して整形する。
 * CombatCalculatorへの依存を注入するために使用される。
 */
import { Parts } from '../../components/index.js';
import { QueryService } from './QueryService.js';
import { EffectService } from './EffectService.js';

export class CombatParameterBuilder {
    /**
     * @param {World} world 
     */
    constructor(world) {
        this.world = world;
    }

    /**
     * CombatContextの内容から計算用パラメータを生成する
     * @param {CombatContext} ctx 
     * @returns {object} CombatCalculator.resolveHitOutcome 用のパラメータ
     */
    buildHitOutcomeParams(ctx) {
        const { attackerId, finalTargetId, attackingPart } = ctx;
        // attackingPart は initializeContext 時点のデータだが、計算には最新のステータス補正等を反映させたい
        // ここでは攻撃側のステータス計算を行う

        if (!finalTargetId) {
            return {
                isSupport: ctx.isSupport,
                evasionChance: 0,
                criticalChance: 0,
                defenseChance: 0,
                initialTargetPartKey: ctx.finalTargetPartKey,
                bestDefensePartKey: null
            };
        }

        // 攻撃側のパーツ情報（脚部含む）を取得
        const attackerParts = this.world.getComponent(attackerId, Parts);
        const attackerLegsData = QueryService.getPartData(this.world, attackerParts.legs);

        // 防御側のパーツ情報（脚部）を取得
        const targetParts = this.world.getComponent(finalTargetId, Parts);
        const targetLegsData = QueryService.getPartData(this.world, targetParts.legs);

        // 計算に使用するステータス
        const calcParams = attackingPart.effects?.find(e => e.type === 'DAMAGE')?.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        // 補正済み攻撃成功値
        const attackerSuccess = EffectService.getStatModifier(this.world, attackerId, baseStatKey, {
            attackingPart: attackingPart,
            attackerLegs: attackerLegsData
        }) + (attackingPart[baseStatKey] || 0);

        // 防御側機動
        const targetMobility = targetLegsData?.mobility || 0;

        // 補正済みクリティカル率
        const bonusChance = attackingPart.criticalBonus || 0; // Traitからの値はattackingPartに含まれている前提

        // 防御側装甲（回避判定用ではなく防御発生率用）
        const targetArmor = targetLegsData?.[defenseStatKey] || 0;

        // 身代わり候補
        const bestDefensePartKey = QueryService.findBestDefensePart(this.world, finalTargetId);

        return {
            isSupport: ctx.isSupport,
            attackerSuccess,
            targetMobility,
            targetArmor,
            bonusChance,
            initialTargetPartKey: ctx.finalTargetPartKey,
            bestDefensePartKey
        };
    }

    /**
     * ダメージ計算用のパラメータを生成する
     * @param {object} params
     * @param {number} params.sourceId
     * @param {number} params.targetId
     * @param {object} params.attackingPart - 攻撃パーツデータ
     * @param {object} params.outcome - 命中判定結果
     */
    buildDamageParams({ sourceId, targetId, attackingPart, outcome }) {
        const attackerParts = this.world.getComponent(sourceId, Parts);
        const targetParts = this.world.getComponent(targetId, Parts);
        
        const attackerLegsData = QueryService.getPartData(this.world, attackerParts.legs);
        const targetLegsData = QueryService.getPartData(this.world, targetParts.legs);

        const calcParams = attackingPart.effects?.find(e => e.type === 'DAMAGE')?.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const powerStatKey = calcParams.powerStat || 'might';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        const effectiveBaseVal = EffectService.getStatModifier(this.world, sourceId, baseStatKey, { 
            attackingPart, 
            attackerLegs: attackerLegsData 
        }) + (attackingPart[baseStatKey] || 0);

        const effectivePowerVal = EffectService.getStatModifier(this.world, sourceId, powerStatKey, { 
            attackingPart, 
            attackerLegs: attackerLegsData 
        }) + (attackingPart[powerStatKey] || 0);

        const mobility = targetLegsData?.mobility || 0;
        const defenseBase = targetLegsData?.[defenseStatKey] || 0;
        const stabilityDefenseBonus = Math.floor((targetLegsData?.stability || 0) / 2);
        const totalDefense = defenseBase + stabilityDefenseBonus;

        return {
            effectiveBaseVal,
            effectivePowerVal,
            mobility,
            totalDefense,
            isCritical: outcome.isCritical,
            isDefenseBypassed: !outcome.isCritical && outcome.isDefended
        };
    }
}