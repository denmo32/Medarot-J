/**
 * @file AI攻撃系ターゲティング戦略
 * @description 攻撃、反撃、汎用的なターゲット選択など、主に敵を対象とする戦略を定義します。
 * 各戦略は、重み付けされたターゲット候補のリスト `Array<{ target: { targetId, targetPartKey }, weight: number }>` を返す責務を持ちます。
 */
import { PlayerInfo, BattleLog, Parts } from '../../core/components/index.js';
import { BattleContext } from '../../core/index.js';
import { 
    isValidTarget, 
    selectRandomPart, 
    getAllPartsFromCandidates, 
    getValidEnemies 
} from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../strategyKeys.js';
import { PartInfo } from '../../common/constants.js';

// 敵を対象とする戦略を生成するための高階関数
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
        if (candidates.length === 0) {
            return null;
        }
        // 共通化されたロジックに候補リストを渡す
        return logicFn({ world, attackerId, candidates });
    };
};


export const offensiveStrategies = {
    /**
     * [SPEED]: 敵の機動力を削ぐため、推進力の高い脚部を優先的に狙う、速攻型の性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.SPEED]: createEnemyTargetingStrategy(({ world, candidates }) => {
        // 候補エンティティを脚部の推進力が高い順にソートする
        const sortedCandidates = candidates.slice().sort((a, b) => {
            const partsA = world.getComponent(a, Parts);
            const partsB = world.getComponent(b, Parts);
            const propulsionA = partsA?.legs?.propulsion || 0;
            const propulsionB = partsB?.legs?.propulsion || 0;
            return propulsionB - propulsionA;
        });

        const targetCandidates = [];
        const weights = [4, 3, 1]; // 上位3候補への重み付け

        sortedCandidates.forEach((id, index) => {
            const targetParts = world.getComponent(id, Parts);
            // 1. 脚部が未破壊かチェック
            if (targetParts?.legs && !targetParts.legs.isBroken) {
                targetCandidates.push({
                    target: { targetId: id, targetPartKey: PartInfo.LEGS.key },
                    weight: weights[index] || 0.5 // 上位3位以降は低い重み
                });
            } else {
                // 2. 脚部が破壊済みの場合、他の未破壊パーツからランダムに選択（優先度低）
                const randomPart = selectRandomPart(world, id);
                if (randomPart) {
                    targetCandidates.push({
                        target: randomPart,
                        weight: 0.5 // 脚部が壊れている場合は優先度を下げる
                    });
                }
            }
        });
        
        return targetCandidates.length > 0 ? targetCandidates : null;
    }),
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.HUNTER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // HPが低い順にソート（昇順）
        allParts.sort((a, b) => a.part.hp - b.part.hp);
        
        const weights = [4, 3, 1];
        return allParts.map((p, index) => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: weights[index] || 0.5
        }));
    }),
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.CRUSHER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // HPが高い順にソート（降順）
        allParts.sort((a, b) => b.part.hp - a.part.hp);

        const weights = [4, 3, 1];
        return allParts.map((p, index) => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: weights[index] || 0.5
        }));
    }),
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.JOKER]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // 全てのパーツに均等な重みを与える
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }),
    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.COUNTER]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        if (targetId && isValidTarget(world, targetId)) {
            // この敵の全パーツを均等な重みで候補リストにする
            const allParts = getAllPartsFromCandidates(world, [targetId]);
            return allParts.map(p => ({
                target: { targetId: p.entityId, targetPartKey: p.partKey },
                weight: 1
            }));
        }
        return null;
    },
    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.GUARD]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleContext);
        if (context && context.history.leaderLastAttackedBy) {
            const targetId = context.history.leaderLastAttackedBy[attackerInfo.teamId];
            if (targetId && isValidTarget(world, targetId)) {
                const allParts = getAllPartsFromCandidates(world, [targetId]);
                return allParts.map(p => ({
                    target: { targetId: p.entityId, targetPartKey: p.partKey },
                    weight: 1
                }));
            }
        } else {
            console.warn('BattleContext not ready for GUARD strategy, returning null for fallback.');
        }
        return null;
    },
    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.FOCUS]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
            // 前回攻撃したパーツのみを候補とし、高い重みを与える
            return [{ 
                target: { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey },
                weight: 10 // ほぼ確実にこのターゲットを選ぶように高い重み
            }];
        }
        return null;
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
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
                // 味方が攻撃したパーツを最優先候補とする
                return [{ 
                    target: { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey },
                    weight: 10
                }];
            }
        }
        console.warn('BattleContext not ready or target is invalid/not an enemy for ASSIST strategy, returning null for fallback.');
        return null;
    },
    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.LEADER_FOCUS]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const leader = candidates.find(id => world.getComponent(id, PlayerInfo).isLeader);
        if (leader) {
            const allParts = getAllPartsFromCandidates(world, [leader]);
            return allParts.map(p => ({
                target: { targetId: p.entityId, targetPartKey: p.partKey },
                weight: 1
            }));
        }
        return null;
    }),
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }>} ターゲット候補リスト
     */
    [TargetingStrategyKey.RANDOM]: createEnemyTargetingStrategy(({ world, candidates }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        // 全てのパーツに均等な重みを与える
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }),
    /**
     * [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     */
    [TargetingStrategyKey.DO_NOTHING]: () => null,
};