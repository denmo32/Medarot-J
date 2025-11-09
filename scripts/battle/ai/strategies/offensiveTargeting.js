/**
 * @file AI攻撃系ターゲティング戦略
 * @description 攻撃、反撃、汎用的なターゲット選択など、主に敵を対象とする戦略を定義します。
 */
import { PlayerInfo, BattleLog } from '../../core/components/index.js';
import { BattleContext } from '../../core/index.js';
import { 
    isValidTarget, 
    selectRandomPart, 
    getAllPartsFromCandidates, 
    selectPartByProbability, 
    getValidEnemies 
} from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../strategyKeys.js';

// 敵を対象とする戦略を生成するための高階関数
/**
 * 敵候補リストの取得という共通処理をカプセル化し、戦略定義の重複を削減する高階関数。
 * @param {function({world: World, attackerId: number, candidates: number[]}): {targetId: number, targetPartKey: string} | null} logicFn 
 *   - 実際のターゲティングロジックを持つ関数。敵候補リスト(candidates)を引数として受け取る。
 * @returns {function({world: World, attackerId: number}): {targetId: number, targetPartKey: string} | null} 
 *   - 標準的なターゲティング戦略関数。
 */
const createEnemyTargetingStrategy = (logicFn) => {
    return ({ world, attackerId }) => {
        const candidates = getValidEnemies(world, attackerId);
        if (candidates.length === 0) {
            return null;
        }
        // 共通化されたロジックに候補リストを渡す
        return logicFn({ world, attackerId, candidates });
    };
};


export const offensiveStrategies = {
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     */
    // 高階関数を使用して戦略を定義
    [TargetingStrategyKey.HUNTER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // HPが低い順にソート（昇順）
        allParts.sort((a, b) => a.part.hp - b.part.hp);
        return selectPartByProbability(allParts);
    }),
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     */
    // 高階関数を使用して戦略を定義
    [TargetingStrategyKey.CRUSHER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // HPが高い順にソート（降順）
        allParts.sort((a, b) => b.part.hp - a.part.hp);
        return selectPartByProbability(allParts);
    }),
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     */
    // 高階関数を使用して戦略を定義
    [TargetingStrategyKey.JOKER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    }),
    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     */
    [TargetingStrategyKey.COUNTER]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        return targetId ? selectRandomPart(world, targetId) : null;
    },
    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     */
    [TargetingStrategyKey.GUARD]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleContext);
        if (context && context.history.leaderLastAttackedBy) {
            const targetId = context.history.leaderLastAttackedBy[attackerInfo.teamId];
            return targetId ? selectRandomPart(world, targetId) : null;
        } else {
            console.warn('BattleContext not ready for GUARD strategy, returning null for fallback.');
            return null;
        }
    },
    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     */
    [TargetingStrategyKey.FOCUS]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
            return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
        }
        return null;
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     */
    [TargetingStrategyKey.ASSIST]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleContext);
        if (context && context.history.teamLastAttack) {
            const teamLastAttack = context.history.teamLastAttack[attackerInfo.teamId];
            if (teamLastAttack.targetId === null) return null;

            const targetInfo = world.getComponent(teamLastAttack.targetId, PlayerInfo);
            const isEnemy = targetInfo && targetInfo.teamId !== attackerInfo.teamId;

            if (isEnemy && isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey)) {
                return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
            }
        }
        console.warn('BattleContext not ready or target is invalid/not an enemy for ASSIST strategy, returning null for fallback.');
        return null;
    },
    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     */
    // 高階関数を使用して戦略を定義
    [TargetingStrategyKey.LEADER_FOCUS]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const leader = candidates.find(id => world.getComponent(id, PlayerInfo).isLeader);
        return leader ? selectRandomPart(world, leader) : null;
    }),
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     */
    // 高階関数を使用して戦略を定義
    [TargetingStrategyKey.RANDOM]: createEnemyTargetingStrategy(({ world, candidates }) => {
        if (!candidates || candidates.length === 0) return null;
        const targetId = candidates[Math.floor(Math.random() * candidates.length)];
        return selectRandomPart(world, targetId);
    }),
    /**
     * [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     */
    [TargetingStrategyKey.DO_NOTHING]: () => null,
};