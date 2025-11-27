/**
 * @file AI攻撃系ターゲティング戦略
 * @description 攻撃、反撃、汎用的なターゲット選択など、主に敵を対象とする戦略を定義します。
 * 各戦略は、重み付けされたターゲット候補のリスト `Array<{ target: { targetId, targetPartKey }, weight: number }>` を返す責務を持ちます。
 */
import { PlayerInfo, Parts } from '../../../components/common/index.js';
import { BattleLog } from '../../../components/battle/index.js';
import { BattleContext } from '../../context/index.js';
import { 
    isValidTarget, 
    selectRandomPart, 
    getAllPartsFromCandidates, 
    getValidEnemies 
} from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../../../config/strategyKeys.js';
import { PartInfo } from '../../../config/constants.js';

// --- 高階関数 (戦略ジェネレータ) ---

/**
 * 敵候補リストの取得という共通処理をカプセル化し、戦略定義の重複を削減する高階関数。
 * @param {function({world: World, attackerId: number, candidates: number[]}): Array<{ target: { targetId: number, targetPartKey: string }, weight: number }> | null} logicFn 
 *   - 実際のターゲティングロジックを持つ関数。敵候補リスト(candidates)を引数として受け取る。
 * @returns {function({world: World, attackerId: number}): Array<{ target: { targetId: number, targetPartKey: string }, weight: number }> | null} 
 *   - 標準的なターゲティング戦略関数。
 */
const createEnemyTargetingStrategy = (logicFn) => {
    return ({ world, attackerId }) => {
        const candidates = getValidEnemies(world, attackerId);
        if (candidates.length === 0) return null;
        return logicFn({ world, attackerId, candidates });
    };
};

/**
 * 敵の全パーツをソートし、上位に重み付けする戦略を生成する高階関数。
 * @param {function(object, object): number} sortFn - パーツをソートするための比較関数。
 * @returns {function} ターゲティング戦略関数
 */
const createSortedPartsStrategy = (sortFn) => createEnemyTargetingStrategy(({ world, candidates }) => {
    const allParts = getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    allParts.sort(sortFn);
    const weights = [4, 3, 1];
    return allParts.map((p, index) => ({
        target: { targetId: p.entityId, targetPartKey: p.partKey },
        weight: weights[index] || 0.5
    }));
});

/**
 * 敵の全パーツに均等な重みを付ける戦略を生成する高階関数。
 * @returns {function} ターゲティング戦略関数
 */
const createUniformWeightStrategy = () => createEnemyTargetingStrategy(({ world, candidates }) => {
    const allParts = getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    return allParts.map(p => ({
        target: { targetId: p.entityId, targetPartKey: p.partKey },
        weight: 1
    }));
});

/**
 * 特定の1体の敵を見つけ、その全パーツを均等な重みでターゲット候補とする戦略を生成する高階関数。
 * @param {function({world: World, candidates: number[]}): number | null} findTargetIdFn - 候補リストからターゲットIDを検索する関数。
 * @returns {function} ターゲティング戦略関数
 */
const createTargetedEntityStrategy = (findTargetIdFn) => createEnemyTargetingStrategy(({ world, candidates }) => {
    const targetId = findTargetIdFn({ world, candidates });
    if (targetId) {
        const allParts = getAllPartsFromCandidates(world, [targetId]);
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }
    return null;
});

/**
 * 敵候補リストに依存せず、特定の単一エンティティの全パーツを候補とする戦略を生成する高階関数。
 * @param {function({world: World, attackerId: number}): number | null} findTargetIdFn - ターゲットIDを検索する関数。
 * @returns {function} ターゲティング戦略関数
 */
const createSingleEntityStrategy = (findTargetIdFn) => ({ world, attackerId }) => {
    const targetId = findTargetIdFn({ world, attackerId });
    if (targetId && isValidTarget(world, targetId)) {
        const allParts = getAllPartsFromCandidates(world, [targetId]);
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }
    return null;
};

/**
 * 敵候補リストに依存せず、特定の単一パーツのみを最優先で狙う戦略を生成する高階関数。
 * @param {function({world: World, attackerId: number}): {targetId: number, partKey: string} | null} findTargetPartFn - ターゲットパーツを検索する関数。
 * @returns {function} ターゲティング戦略関数
 */
const createSinglePartStrategy = (findTargetPartFn) => ({ world, attackerId }) => {
    const target = findTargetPartFn({ world, attackerId });
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    if (!target) return null;
    
    // 味方へのアシスト/フォーカスはしないように、ターゲットが敵であることを確認
    const targetInfo = world.getComponent(target.targetId, PlayerInfo);
    const isEnemy = targetInfo && targetInfo.teamId !== attackerInfo.teamId;

    if (isEnemy && isValidTarget(world, target.targetId, target.partKey)) {
        return [{
            target: { targetId: target.targetId, targetPartKey: target.partKey },
            weight: 10 // ほぼ確実にこのターゲットを選ぶように高い重み
        }];
    }
    return null;
};


// --- 戦略定義 ---

export const offensiveStrategies = {
    /**
     * [SPEED]: 敵の機動力を削ぐため、推進力の高い脚部を優先的に狙う、速攻型の性格。
     */
    [TargetingStrategyKey.SPEED]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const sortedCandidates = candidates.slice().sort((a, b) => {
            const partsA = world.getComponent(a, Parts);
            const partsB = world.getComponent(b, Parts);
            const propulsionA = partsA?.legs?.propulsion || 0;
            const propulsionB = partsB?.legs?.propulsion || 0;
            return propulsionB - propulsionA;
        });

        const targetCandidates = [];
        const weights = [4, 3, 1];

        sortedCandidates.forEach((id, index) => {
            const targetParts = world.getComponent(id, Parts);
            if (targetParts?.legs && !targetParts.legs.isBroken) {
                targetCandidates.push({
                    target: { targetId: id, targetPartKey: PartInfo.LEGS.key },
                    weight: weights[index] || 0.5
                });
            } else {
                const randomPart = selectRandomPart(world, id);
                if (randomPart) {
                    targetCandidates.push({ target: randomPart, weight: 0.5 });
                }
            }
        });
        
        return targetCandidates.length > 0 ? targetCandidates : null;
    }),

    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     */
    [TargetingStrategyKey.HUNTER]: createSortedPartsStrategy((a, b) => a.part.hp - b.part.hp),

    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     */
    [TargetingStrategyKey.CRUSHER]: createSortedPartsStrategy((a, b) => b.part.hp - a.part.hp),

    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     */
    [TargetingStrategyKey.JOKER]: createUniformWeightStrategy(),

    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     */
    [TargetingStrategyKey.COUNTER]: createSingleEntityStrategy(({ world, attackerId }) =>
        world.getComponent(attackerId, BattleLog)?.lastAttackedBy
    ),

    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     */
    [TargetingStrategyKey.GUARD]: createSingleEntityStrategy(({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleContext);
        return context?.history.leaderLastAttackedBy?.[attackerInfo.teamId] || null;
    }),

    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     */
    [TargetingStrategyKey.FOCUS]: createSinglePartStrategy(({ world, attackerId }) =>
        world.getComponent(attackerId, BattleLog)?.lastAttack
    ),

    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     */
    [TargetingStrategyKey.ASSIST]: createSinglePartStrategy(({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleContext);
        const teamLastAttack = context?.history.teamLastAttack?.[attackerInfo.teamId];
        return (teamLastAttack && teamLastAttack.targetId !== null) ? teamLastAttack : null;
    }),

    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     */
    [TargetingStrategyKey.LEADER_FOCUS]: createTargetedEntityStrategy(({ world, candidates }) => 
        candidates.find(id => world.getComponent(id, PlayerInfo).isLeader)
    ),

    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     */
    [TargetingStrategyKey.RANDOM]: createUniformWeightStrategy(),

    /**
     * [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     */
    [TargetingStrategyKey.DO_NOTHING]: () => null,
};
