/**
 * @file AI攻撃系ターゲティング戦略
 */
import { PlayerInfo, Parts } from '../../../components/index.js';
import { BattleLog } from '../../components/index.js';
import { BattleHistoryContext } from '../../components/BattleHistoryContext.js';
import { QueryService } from '../../services/QueryService.js';
import { TargetingService } from '../../services/TargetingService.js';
import { TargetingStrategyKey } from '../strategyKeys.js';
import { PartInfo } from '../../../common/constants.js';

// --- 高階関数 (戦略ジェネレータ) ---

const createEnemyTargetingStrategy = (logicFn) => {
    return ({ world, attackerId }) => {
        const candidates = TargetingService.getValidEnemies(world, attackerId);
        if (candidates.length === 0) return null;
        return logicFn({ world, attackerId, candidates });
    };
};

const createSortedPartsStrategy = (sortFn) => createEnemyTargetingStrategy(({ world, candidates }) => {
    const allParts = QueryService.getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    allParts.sort(sortFn);
    const weights = [4, 3, 1];
    return allParts.map((p, index) => ({
        target: { targetId: p.entityId, targetPartKey: p.partKey },
        weight: weights[index] || 0.5
    }));
});

const createUniformWeightStrategy = () => createEnemyTargetingStrategy(({ world, candidates }) => {
    const allParts = QueryService.getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    return allParts.map(p => ({
        target: { targetId: p.entityId, targetPartKey: p.partKey },
        weight: 1
    }));
});

const createTargetedEntityStrategy = (findTargetIdFn) => createEnemyTargetingStrategy(({ world, candidates }) => {
    const targetId = findTargetIdFn({ world, candidates });
    if (targetId) {
        const allParts = QueryService.getAllPartsFromCandidates(world, [targetId]);
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }
    return null;
});

const createSingleEntityStrategy = (findTargetIdFn) => ({ world, attackerId }) => {
    const targetId = findTargetIdFn({ world, attackerId });
    if (targetId && TargetingService.isValidTarget(world, targetId)) {
        const allParts = QueryService.getAllPartsFromCandidates(world, [targetId]);
        return allParts.map(p => ({
            target: { targetId: p.entityId, targetPartKey: p.partKey },
            weight: 1
        }));
    }
    return null;
};

const createSinglePartStrategy = (findTargetPartFn) => ({ world, attackerId }) => {
    const target = findTargetPartFn({ world, attackerId });
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    if (!target) return null;
    
    const targetInfo = world.getComponent(target.targetId, PlayerInfo);
    const isEnemy = targetInfo && targetInfo.teamId !== attackerInfo.teamId;

    if (isEnemy && TargetingService.isValidTarget(world, target.targetId, target.partKey)) {
        return [{
            target: { targetId: target.targetId, targetPartKey: target.partKey },
            weight: 10
        }];
    }
    return null;
};


// --- 戦略定義 ---

export const offensiveStrategies = {
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
                const randomPart = QueryService.selectRandomPart(world, id);
                if (randomPart) {
                    targetCandidates.push({ target: randomPart, weight: 0.5 });
                }
            }
        });
        
        return targetCandidates.length > 0 ? targetCandidates : null;
    }),

    [TargetingStrategyKey.HUNTER]: createSortedPartsStrategy((a, b) => a.part.hp - b.part.hp),

    [TargetingStrategyKey.CRUSHER]: createSortedPartsStrategy((a, b) => b.part.hp - a.part.hp),

    [TargetingStrategyKey.JOKER]: createUniformWeightStrategy(),

    [TargetingStrategyKey.COUNTER]: createSingleEntityStrategy(({ world, attackerId }) =>
        world.getComponent(attackerId, BattleLog)?.lastAttackedBy
    ),

    [TargetingStrategyKey.GUARD]: createSingleEntityStrategy(({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleHistoryContext);
        return context?.history.leaderLastAttackedBy?.[attackerInfo.teamId] || null;
    }),

    [TargetingStrategyKey.FOCUS]: createSinglePartStrategy(({ world, attackerId }) =>
        world.getComponent(attackerId, BattleLog)?.lastAttack
    ),

    [TargetingStrategyKey.ASSIST]: createSinglePartStrategy(({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleHistoryContext);
        const teamLastAttack = context?.history.teamLastAttack?.[attackerInfo.teamId];
        return (teamLastAttack && teamLastAttack.targetId !== null) ? teamLastAttack : null;
    }),

    [TargetingStrategyKey.LEADER_FOCUS]: createTargetedEntityStrategy(({ world, candidates }) => 
        candidates.find(id => world.getComponent(id, PlayerInfo).isLeader)
    ),

    [TargetingStrategyKey.RANDOM]: createUniformWeightStrategy(),

    [TargetingStrategyKey.DO_NOTHING]: () => null,
};