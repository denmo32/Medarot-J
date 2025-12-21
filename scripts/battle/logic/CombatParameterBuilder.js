/**
 * @file CombatParameterBuilder.js
 * @description 戦闘計算に必要なパラメータオブジェクトを構築するロジック関数。
 * importパス修正: PartsはCommon, 他はそのまま
 */
import { Parts } from '../../components/index.js'; // Common
import { BattleQueries } from '../queries/BattleQueries.js';
import { StatCalculator } from './StatCalculator.js';

/**
 * CombatContextの内容から計算用パラメータを生成する
 * @param {World} world
 * @param {CombatContext} ctx 
 * @returns {object} CombatCalculator.resolveHitOutcome 用のパラメータ
 */
export function buildHitOutcomeParams(world, ctx) {
    const { attackerId, finalTargetId, attackingPart } = ctx;
    // attackingPart は initializeContext 時点のデータ (Snapshot)

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
    const attackerParts = world.getComponent(attackerId, Parts);
    // Statsコンポーネントのみ取得 (オブジェクト生成を回避)
    const attackerLegsStats = BattleQueries.getPartStats(world, attackerParts.legs);

    // 防御側のパーツ情報（脚部）を取得
    const targetParts = world.getComponent(finalTargetId, Parts);
    const targetLegsStats = BattleQueries.getPartStats(world, targetParts.legs);

    // 計算に使用するステータス
    const calcParams = attackingPart.effects?.find(e => e.type === 'DAMAGE')?.calculation || {};
    const baseStatKey = calcParams.baseStat || 'success';
    const defenseStatKey = calcParams.defenseStat || 'armor';

    // 補正済み攻撃成功値
    const attackerSuccess = StatCalculator.getStatModifier(world, attackerId, baseStatKey, {
        attackingPart: attackingPart,
        attackerLegs: attackerLegsStats
    }) + (attackingPart[baseStatKey] || 0);

    // 防御側機動
    const targetMobility = targetLegsStats?.mobility || 0;

    // 補正済みクリティカル率
    const bonusChance = attackingPart.criticalBonus || 0;

    // 防御側装甲（回避判定用ではなく防御発生率用）
    const targetArmor = targetLegsStats?.[defenseStatKey] || 0;

    // 身代わり候補
    const bestDefensePartKey = BattleQueries.findBestDefensePart(world, finalTargetId);

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
 * @param {World} world
 * @param {object} params
 * @param {number} params.sourceId
 * @param {number} params.targetId
 * @param {object} params.attackingPart - 攻撃パーツデータ
 * @param {object} params.outcome - 命中判定結果
 */
export function buildDamageParams(world, { sourceId, targetId, attackingPart, outcome }) {
    const attackerParts = world.getComponent(sourceId, Parts);
    const targetParts = world.getComponent(targetId, Parts);
    
    // 軽量なStats取得に変更
    const attackerLegsStats = BattleQueries.getPartStats(world, attackerParts.legs);
    const targetLegsStats = BattleQueries.getPartStats(world, targetParts.legs);

    const calcParams = attackingPart.effects?.find(e => e.type === 'DAMAGE')?.calculation || {};
    const baseStatKey = calcParams.baseStat || 'success';
    const powerStatKey = calcParams.powerStat || 'might';
    const defenseStatKey = calcParams.defenseStat || 'armor';

    const effectiveBaseVal = StatCalculator.getStatModifier(world, sourceId, baseStatKey, { 
        attackingPart, 
        attackerLegs: attackerLegsStats 
    }) + (attackingPart[baseStatKey] || 0);

    const effectivePowerVal = StatCalculator.getStatModifier(world, sourceId, powerStatKey, { 
        attackingPart, 
        attackerLegs: attackerLegsStats 
    }) + (attackingPart[powerStatKey] || 0);

    const mobility = targetLegsStats?.mobility || 0;
    const defenseBase = targetLegsStats?.[defenseStatKey] || 0;
    const stabilityDefenseBonus = Math.floor((targetLegsStats?.stability || 0) / 2);
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