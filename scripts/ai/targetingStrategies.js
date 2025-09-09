/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */

import { Parts, PlayerInfo, GameState, BattleLog, GameContext } from '../core/components.js';
import { PartType, PlayerStateType, MedalPersonality } from '../common/constants.js';
// ★追加: battleUtilsから関数をインポート
import { isValidTarget, selectRandomPart } from '../utils/battleUtils.js';

/**
 * メダルの性格に基づいたターゲット決定戦略のコレクション。
 * なぜこの形式なのか？
 * これは「ストラテジーパターン」と呼ばれる設計パターンの一種です。AIの性格（戦略）ごとにアルゴリズムを分離して管理することで、
 * 新しい性格（例えば「回復パーツを優先的に狙う」など）を追加したくなった場合に、このオブジェクトに新しい関数を追加するだけで済み、
 * 他のコードに影響を与えることなく、容易にAIのバリエーションを増やすことができます。
 */
export const targetingStrategies = {
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     * 敵全体のパーツの中で、現在HPが最も低いものを狙います。
     */
    [MedalPersonality.HUNTER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => a.part.hp - b.part.hp);
    },

    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * 敵全体のパーツの中で、現在HPが最も高いものを狙います。
     */
    [MedalPersonality.CRUSHER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => b.part.hp - a.part.hp);
    },

    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * 敵全体の全パーツの中から、完全にランダムで1つをターゲットとします。
     */
    [MedalPersonality.JOKER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },

    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     * 自分を最後に攻撃してきた敵を狙います。いなければ、フォールバックとして別の戦略が選択されます。
     */
    [MedalPersonality.COUNTER]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     * 味方チームのリーダーを最後に攻撃した敵を狙います。
     */
    [MedalPersonality.GARD]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const targetId = context.leaderLastAttackedBy[attackerInfo.teamId];
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     * 自分が前回攻撃したのと同じパーツを、執拗に狙い続けます。
     */
    [MedalPersonality.FOCUS]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
            return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
        }
        return null;
    },

    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     * 味方が最後に攻撃した敵のパーツを狙い、集中攻撃を仕掛けます。
     */
    [MedalPersonality.ASSIST]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
        if (isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey)) {
            return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
        }
        return null;
    },

    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     * 戦略の基本として、敵チームのリーダーを最優先で狙います。
     */
    [MedalPersonality.LEADER_FOCUS]: (world, attackerId, enemies) => {
        const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
        if (isValidTarget(world, leader)) {
            return selectRandomPart(world, leader);
        }
        return null;
    },

    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * 敵1体をランダムに選び、そのパーツをランダムに狙います。
     */
    [MedalPersonality.RANDOM]: (world, attackerId, enemies) => {
        if (enemies.length === 0) return null;
        const targetId = enemies[Math.floor(Math.random() * enemies.length)];
        return selectRandomPart(world, targetId);
    }
};

/**
 * 共通ヘルパー: 条件に基づいて最適なパーツを選択するための汎用関数。
 * @param {World} world
 * @param {number[]} enemies - 敵エンティティIDの配列
 * @param {function} sortFn - パーツを評価・ソートするための比較関数
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
function selectPartByCondition(world, enemies, sortFn) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;

    // 提供されたソート関数でパーツを並び替え、最も評価の高いものを選択します。
    allParts.sort(sortFn);

    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}



/**
 * 指定された敵たちの、破壊されていない全攻撃可能パーツのリストを取得します。
 * @param {World} world
 * @param {number[]} enemyIds
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
function getAllEnemyParts(world, enemyIds) {
    let allParts = [];
    for (const id of enemyIds) {
        const parts = world.getComponent(id, Parts);
        Object.entries(parts).forEach(([key, part]) => {
            // 脚部パーツは攻撃対象外とするため、除外します。
            if (!part.isBroken && key !== PartType.LEGS) {
                allParts.push({ entityId: id, partKey: key, part: part });
            }
        });
    }
    return allParts;
}

