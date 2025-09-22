import { CONFIG } from '../common/config.js';
import { Parts, Position, PlayerInfo, GameState } from '../core/components.js';
// ★改善: PartInfoを参照することで、ハードコードされた文字列を排除
import { PartInfo, PlayerStateType } from '../common/constants.js';

/**
 * 回避確率を計算する
 * 
 * 公式: (mobility - success) / [係数A] + [係数B] を 0-[係数C] の範囲にクリップ
 * - mobility: ターゲットの機動値
 * - success: 攻撃側の成功値
 * 
 * @param {number} mobility - ターゲットの機動値
 * @param {number} success - 攻撃側の成功値
 * @returns {number} 0-Xの範囲で確率を返す
 */
export function calculateEvasionChance(mobility, success) {
    // ★改善: 計算式をconfigから参照することで、バランス調整を容易にする
    const formula = CONFIG.FORMULAS.EVASION;
    const base = (mobility - success) / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
    return Math.max(0, Math.min(formula.MAX_CHANCE, base));
}

/**
 * 防御確率を計算する
 * 
 * 公式: armor / [係数A] + [係数B] を 0-[係数C] の範囲にクリップ
 * - armor: ターゲットの防御値
 * 
 * @param {number} armor - ターゲットの防御値
 * @returns {number} 0-Xの範囲で確率を返す
 */
export function calculateDefenseChance(armor) {
    // ★改善: 計算式をconfigから参照することで、バランス調整を容易にする
    const formula = CONFIG.FORMULAS.DEFENSE;
    const base = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;
    return Math.max(0, Math.min(formula.MAX_CHANCE, base));
}

/**
 * ★新規: クリティカルヒットの発生確率を計算する関数。
 * 攻撃側の成功度が防御側の回避度を上回るほど、発生確率が上昇します。
 * @param {object} attackingPart - 攻撃側のパーツ
 * @param {object} targetLegs - ターゲットの脚部パーツ
 * @returns {number} 0から1の間の発生確率
 */
export function calculateCriticalChance(attackingPart, targetLegs) {
    const config = CONFIG.CRITICAL_HIT;
    if (!config) return 0;

    const success = attackingPart.success || 0;
    const mobility = targetLegs.mobility || 0;

    // 成功度と機動度の差を計算（マイナスにならないようにする）
    const difference = Math.max(0, success - mobility);

    // 基本確率を計算
    let chance = difference / config.DIFFERENCE_FACTOR;

    // 攻撃タイプによるボーナスを加算
    const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
    chance += typeBonus;
    
    // 最終的な確率を0から1の範囲に収める
    return Math.max(0, Math.min(1, chance));
}


/**
 * ダメージを計算する
 * 
 * ダメージ計算式の意味:
 * 1. baseDamage = max(0, 攻撃成功値 - ターゲット機動値 - ターゲット防御値)
 *    - 攻撃側の成功値が高ければ、よりダメージが入りやすくなる
 *    - ターゲットの機動/防御値が高いほど、ダメージが軽減される
 * 2. finalDamage = floor(baseDamage / 4) + 攻撃威力
 *    - baseDamage は4で割ってスケーリングされ、攻撃威力が直接加算される
 *    - これにより、高威力の攻撃がより大きなダメージを与えるようになる
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {number} targetId - ターゲットのエンティティID
 * @param {object} action - 攻撃アクション情報
 * @param {boolean} isCritical - クリティカルヒットが発生したかどうか
 * @param {boolean} isDefenseBypassed - ★新規: 防御に失敗し、防御度が無効化されるかどうか
 * @returns {number} 計算されたダメージ値
 */
export function calculateDamage(world, attackerId, targetId, action, isCritical = false, isDefenseBypassed = false) {
    const attackerParts = world.getComponent(attackerId, Parts);
    const attackingPart = attackerParts[action.partKey];
    const targetParts = world.getComponent(targetId, Parts);
    // 攻撃パーツまたはターゲットパーツが見つからない場合は0ダメージ
    if (!attackingPart || !targetParts) {
        return 0;
    }
    // 新しいダメージ計算式に必要なパラメータを取得
    let success = attackingPart.success || 0; // 攻撃側成功度
    let might = attackingPart.might || 0;       // 攻撃側威力度
    const mobility = targetParts.legs.mobility || 0; // ターゲット回避度
    let armor = targetParts.legs.armor || 0;       // ターゲット防御度

    // ★新規: 攻撃タイプに応じたボーナス計算
    const attackerLegs = attackerParts.legs;
    let bonusType = '';
    let bonusValue = 0;

    switch (attackingPart.type) {
        case '狙い撃ち': // 安定性の半分を成功度に追加
            bonusValue = Math.floor((attackerLegs.stability || 0) / 2);
            success += bonusValue;
            bonusType = `stability/2 (+${bonusValue})`;
            break;
        case '殴る': // 機動の半分を成功度に追加
            bonusValue = Math.floor((attackerLegs.mobility || 0) / 2);
            success += bonusValue;
            bonusType = `mobility/2 (+${bonusValue})`;
            break;
        case '我武者羅': // 推進の半分を威力に追加
            bonusValue = Math.floor((attackerLegs.propulsion || 0) / 2);
            might += bonusValue;
            bonusType = `propulsion/2 (+${bonusValue})`;
            break;
        // '撃つ' はボーナスなし
    }

    // ★新規: 防御側のstabilityを防御度に加算
    const targetLegs = targetParts.legs;
    const defenseBonus = Math.floor((targetLegs.stability || 0) / 2);
    armor += defenseBonus;
    
    // ★変更: クリティカルヒットか否かでダメージ計算式を分岐
    let baseDamage;
    if (isCritical) {
        // クリティカルヒットの場合、ダメージ計算式から mobility と armor の影響を完全に排除する
        baseDamage = Math.max(0, success);
    } else {
        // ★新規: 防御失敗（防御度無効化）の場合、armorを0として扱う
        if (isDefenseBypassed) {
            armor = 0;
        }
        // 通常ヒットの場合、mobilityと（条件付きの）armorを減算
        baseDamage = Math.max(0, success - mobility - armor);
    }

    const finalDamage = Math.floor(baseDamage / 4) + might;

    // デバッグモードが有効な場合のみログを出力
    if (CONFIG.DEBUG) {
        console.log(`--- ダメージ計算 (Attacker: ${attackerId}, Target: ${targetId}) ---`);
        console.log(`  攻撃側: 素の成功=${attackingPart.success}, 素の威力=${attackingPart.might}`);
        if (bonusType) {
            console.log(`  - 攻撃タイプボーナス (${attackingPart.type}): ${bonusType}`);
        }
        console.log(`  => 最終的な攻撃パラメータ: 成功=${success}, 威力=${might}`);
        
        console.log(`  ターゲット側: 機動=${mobility}, 素の防御=${targetLegs.armor || 0}`);
        if (defenseBonus > 0) {
            console.log(`  - 防御ボーナス (stability/2): +${defenseBonus}`);
        }
        console.log(`  => 最終的な防御パラメータ: 防御=${armor}`);

        if (isCritical) {
            console.log('  - ★クリティカルヒット発生！ ターゲットの回避度・防御度を無視！');
            console.log(`  計算過程: Math.floor(Math.max(0, ${success}) / 4) + ${might} = ${finalDamage}`);
        } else if (isDefenseBypassed) {
            console.log('  - ●防御失敗！ ターゲットの防御度を無視！');
            console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - 0) / 4) + ${might} = ${finalDamage}`);
        } else {
            console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - ${armor}) / ${CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR}) + ${might} = ${finalDamage}`);
        }
        console.log(`  - 最終ダメージ: ${finalDamage}`);
    }
    return finalDamage;
}

/**
 * 指定されたエンティティのパーツを取得します。
 * フィルタリングオプションにより、攻撃用パーツのみ、または全てのパーツを取得可能。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @param {boolean} includeBroken - 破壊されたパーツも含めるか（デフォルト: false）
 * @param {boolean} attackableOnly - 攻撃用パーツのみ取得するか（デフォルト: true）
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    if (!world || entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];
    
    // ★改善: ハードコードされたキーではなく、PartInfoから攻撃パーツのキーリストを生成
    const attackablePartKeys = [PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key];
    
    let partTypes = attackableOnly 
        ? attackablePartKeys 
        : Object.keys(parts);
        
    return Object.entries(parts)
        .filter(([key, part]) => partTypes.includes(key) && (includeBroken || !part.isBroken));
}

/**
 * 指定されたエンティティの、破壊されていない「攻撃用」パーツのリストを取得します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAttackableParts(world, entityId) {
    return getParts(world, entityId, false, true);
}

/**
 * 指定されたエンティティの、破壊状態に関わらず全ての「攻撃用」パーツのリストを取得します。
 * 行動選択UIで、破壊されたパーツを無効状態で表示するために使用します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAllActionParts(world, entityId) {
    return getParts(world, entityId, true, true);
}

/**
 * 防御に最適なパーツ（頭部以外で最もHPが高い）を見つけます。
 * @param {World} world
 * @param {number} entityId - 防御側のエンティティID
 * @returns {string | null} - 最適な防御パーツのキー、またはnull
 */
export function findBestDefensePart(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;
    const defendableParts = Object.entries(parts)
        // ★改善: ハードコードされた 'head' を PartInfo.HEAD.key に変更
        .filter(([key, part]) => key !== PartInfo.HEAD.key && !part.isBroken);
    if (defendableParts.length === 0) return null;
    // HPで降順ソートして、最もHPが高いパーツを返す
    defendableParts.sort(([, a], [, b]) => b.hp - a.hp);
    return defendableParts[0][0]; // [key, part] の key を返す
}

/**
 * 生存している敵エンティティのリストを取得します
 * @param {World} world
 * @param {number} attackerId
 * @returns {number[]}
 */
export function getValidEnemies(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    return world.getEntitiesWith(PlayerInfo, GameState)
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const gState = world.getComponent(id, GameState);
            return id !== attackerId && pInfo.teamId !== attackerInfo.teamId && gState.state !== PlayerStateType.BROKEN;
        });
}

/**
 * 指定されたターゲットIDやパーツキーが現在有効（生存・未破壊）か検証します。
 * @param {World} world
 * @param {number} targetId
 * @param {string | null} partKey
 * @returns {boolean}
 */
export function isValidTarget(world, targetId, partKey = null) {
    if (targetId === null || targetId === undefined) return false;
    const gameState = world.getComponent(targetId, GameState);
    if (!gameState || gameState.state === PlayerStateType.BROKEN) return false;
    if (partKey) {
        const parts = world.getComponent(targetId, Parts);
        if (!parts || !parts[partKey] || parts[partKey].isBroken) {
            return false;
        }
    }
    return true;
}

/**
 * 指定されたエンティティから攻撃可能なパーツをランダムに1つ選択します。
 * ActionSystemが格闘攻撃のターゲットパーツを決定するために使用します。
 * @param {World} world
 * @param {number} entityId - ターゲットのエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectRandomPart(world, entityId) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;
    // 破壊されていない攻撃可能なパーツのみを候補とします。
    const hittablePartKeys = Object.keys(parts).filter(key => !parts[key].isBroken);
    if (hittablePartKeys.length > 0) {
        const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null; // 攻撃可能なパーツがない場合
}

/**
 * 格闘攻撃用に、最もX軸距離の近い敵を見つけます。
 * @param {World} world
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {number | null} - 最も近い敵のエンティティID、またはnull
 */
export function findNearestEnemy(world, attackerId) {
    const attackerPos = world.getComponent(attackerId, Position);
    if (!attackerPos) return null;
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;
    let closestEnemyId = null;
    let minDistance = Infinity;
    for (const enemyId of enemies) {
        const enemyPos = world.getComponent(enemyId, Position);
        if (enemyPos) {
            const distance = Math.abs(attackerPos.x - enemyPos.x);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemyId = enemyId;
            }
        }
    }
    return closestEnemyId;
}

/**
 * 全ての敵パーツを取得する
 * @param {World} world
 * @param {number[]} enemyIds
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
export function getAllEnemyParts(world, enemyIds) {
    let allParts = [];
    for (const id of enemyIds) {
        const parts = world.getComponent(id, Parts);
        Object.entries(parts).forEach(([key, part]) => {
            if (!part.isBroken) {
                allParts.push({ entityId: id, partKey: key, part: part });
            }
        });
    }
    return allParts;
}

/**
 * 条件に基づいて最適なパーツを選択するための汎用関数
 * @param {World} world
 * @param {number[]} enemies - 敵エンティティIDの配列
 * @param {function} sortFn - パーツを評価・ソートするための比較関数
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectPartByCondition(world, enemies, sortFn) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;
    allParts.sort(sortFn);
    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}