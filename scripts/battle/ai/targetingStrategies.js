/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */
import { Parts, PlayerInfo, GameState, BattleLog } from '../core/components/index.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
import { PlayerStateType, MedalPersonality, PartInfo, TeamID } from '../common/constants.js'; // Import TeamID for context keys, add BattleHistoryContext import
import { isValidTarget, selectRandomPart, getAllPartsFromCandidates, selectPartByCondition, getValidEnemies, getValidAllies, findMostDamagedAllyPart } from '../utils/queryUtils.js';
import { GameEvents } from '../common/events.js';
/**
 * メダルの性格に基づいたターゲット決定戦略のコレクション。
 * これは「ストラテジーパターン」と呼ばれる設計パターンの一種です。AIの性格（戦略）ごとにアルゴリズムを分離して管理することで、
 * 新しい性格（例えば「回復パーツを優先的に狙う」など）を追加したくなった場合に、このオブジェクトに新しい関数を追加するだけで済み、
 * 他のコードに影響を与えることなく、容易にAIのバリエーションを増やすことができます。
 */
export const targetingStrategies = {
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     * 敵全体のパーツの中で、現在HPが最も低いものを狙います。
     */
    [MedalPersonality.HUNTER]: ({ world, candidates, attackerId }) => {
        return selectPartByCondition(world, candidates, (a, b) => a.part.hp - b.part.hp);
    },
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * 敵全体のパーツの中で、現在HPが最も高いものを狙います。
     */
    [MedalPersonality.CRUSHER]: ({ world, candidates, attackerId }) => {
        return selectPartByCondition(world, candidates, (a, b) => b.part.hp - a.part.hp);
    },
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * 敵全体の「攻撃可能な全パーツ」を一つの大きなリストとみなし、その中から完全にランダムで1つをターゲットとします。
     * 結果として、健在なパーツを多く持つ敵が狙われやすくなります。
     */
    [MedalPersonality.JOKER]: ({ world, candidates, attackerId }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },
    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     * 自分を最後に攻撃してきた敵を狙います。いなければ、フォールバックとして別の戦略が選択されます。
     */
    [MedalPersonality.COUNTER]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        return targetId ? selectRandomPart(world, targetId) : null;
    },
    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     * 味方チームのリーダーを最後に攻撃した敵を狙います。
     */
    [MedalPersonality.GUARD]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleHistoryContext);
        // Check if BattleHistoryContext and its data are available
        if (context && context.leaderLastAttackedBy) {
            const targetId = context.leaderLastAttackedBy[attackerInfo.teamId];
            return targetId ? selectRandomPart(world, targetId) : null;
        } else {
            // Return null if context is not ready; determineTarget will handle fallback
            console.warn('BattleHistoryContext not ready for GUARD strategy, returning null for fallback.');
            return null;
        }
    },
    /**
     * [FOCUS]: 一度狙った獲物は逃さない、執拗な性格。
     * 自分が前回攻撃したのと同じパーツを、執拗に狙い続けます。
     */
    [MedalPersonality.FOCUS]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     * 味方が最後に攻撃した敵のパーツを狙い、集中攻撃を仕掛けます。
     */
    [MedalPersonality.ASSIST]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(BattleHistoryContext);
        // Check if BattleHistoryContext and its data are available
        if (context && context.teamLastAttack) {
            const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
            return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
        } else {
            // Return null if context is not ready; determineTarget will handle fallback
            console.warn('BattleHistoryContext not ready for ASSIST strategy, returning null for fallback.');
            return null;
        }
    },
    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     * 戦略の基本として、敵チームのリーダーを最優先で狙います。
     */
    [MedalPersonality.LEADER_FOCUS]: ({ world, candidates, attackerId }) => {
        const leader = candidates.find(id => world.getComponent(id, PlayerInfo).isLeader);
        return leader ? selectRandomPart(world, leader) : null;
    },
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * まず「敵1体」をランダムに選び、次にその敵のパーツをランダムに狙います。
     * どの敵機体も等しい確率で選ばれます。
     */
    [MedalPersonality.RANDOM]: ({ world, candidates, attackerId }) => {
        if (!candidates || candidates.length === 0) return null;
        const targetId = candidates[Math.floor(Math.random() * candidates.length)];
        return selectRandomPart(world, targetId);
    },

    /**
     * [HEALER]: 味方を回復することに専念する、支援的な性格。
     * 味方全体のパーツの中で、最もHPの減りが大きい（最大HP - 現在HP が最大）ものを狙います。
     */
    [MedalPersonality.HEALER]: ({ world, candidates, attackerId }) => {
        return findMostDamagedAllyPart(world, candidates);
    },

    /**
     * [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     * 常にnullを返すことで、フォールバックアクションを防ぎます。
	 * 通常、この戦略が呼び出されることはないはずです。
     */
    DO_NOTHING: () => null,
};

/**
 * AIターゲティング戦略のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 * `personalityRegistry`などで使用されます。
 */
export const TargetingStrategyKey = Object.keys(targetingStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});