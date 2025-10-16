/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */
import { Parts, PlayerInfo, GameState, BattleLog } from '../core/components/index.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
// ★改善: PartInfoを参照することで、ハードコードされた文字列を排除
import { PlayerStateType, MedalPersonality, PartInfo, TeamID } from '../common/constants.js'; // Import TeamID for context keys, add BattleHistoryContext import
// ★変更: findMostDamagedAllyPart をインポート
import { isValidTarget, selectRandomPart, getAllPartsFromCandidates, selectPartByCondition, getValidEnemies, getValidAllies, findMostDamagedAllyPart } from '../utils/queryUtils.js';
import { GameEvents } from '../common/events.js';
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
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: candidates を使用
     */
    [MedalPersonality.HUNTER]: ({ world, candidates, attackerId }) => {
        // ★リファクタリング: イベント発行の責務を呼び出し元(targetingUtils)に移譲
        return selectPartByCondition(world, candidates, (a, b) => a.part.hp - b.part.hp);
    },
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * 敵全体のパーツの中で、現在HPが最も高いものを狙います。
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: candidates を使用
     */
    [MedalPersonality.CRUSHER]: ({ world, candidates, attackerId }) => {
        // ★リファクタリング: イベント発行の責務を呼び出し元(targetingUtils)に移譲
        return selectPartByCondition(world, candidates, (a, b) => b.part.hp - a.part.hp);
    },
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * 敵全体の「攻撃可能な全パーツ」を一つの大きなリストとみなし、その中から完全にランダムで1つをターゲットとします。
     * 結果として、健在なパーツを多く持つ敵が狙われやすくなります。
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: candidates を使用
     */
    [MedalPersonality.JOKER]: ({ world, candidates, attackerId }) => {
        // ★変更: getAllEnemyParts -> getAllPartsFromCandidates
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        // ★リファクタリング: イベント発行の責務を呼び出し元(targetingUtils)に移譲
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },
    /**
     * [COUNTER]: 受けた攻撃に即座にやり返す、短期的な性格。
     * 自分を最後に攻撃してきた敵を狙います。いなければ、フォールバックとして別の戦略が選択されます。
     * ★改善: 引数をコンテキストオブジェクトに変更
     */
    [MedalPersonality.COUNTER]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        return targetId ? selectRandomPart(world, targetId) : null;
    },
    /**
     * [GUARD]: リーダーを守ることを最優先する、護衛のような性格。
     * 味方チームのリーダーを最後に攻撃した敵を狙います。
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: 新しいBattleHistoryContextを使用し、nullチェックを追加
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
     * ★改善: 引数をコンテキストオブジェクトに変更
     */
    [MedalPersonality.FOCUS]: ({ world, attackerId }) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     * 味方が最後に攻撃した敵のパーツを狙い、集中攻撃を仕掛けます。
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: 新しいBattleHistoryContextを使用し、nullチェックを追加
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
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: candidates を使用
     */
    [MedalPersonality.LEADER_FOCUS]: ({ world, candidates, attackerId }) => {
        const leader = candidates.find(id => world.getComponent(id, PlayerInfo).isLeader);
        // ★リファクタリング: イベント発行の責務を呼び出し元(targetingUtils)に移譲
        return leader ? selectRandomPart(world, leader) : null;
    },
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * まず「敵1体」をランダムに選び、次にその敵のパーツをランダムに狙います。
     * どの敵機体も等しい確率で選ばれます。
     * ★改善: 引数をコンテキストオブジェクトに変更
     * ★修正: candidates を使用
     */
    [MedalPersonality.RANDOM]: ({ world, candidates, attackerId }) => {
        if (!candidates || candidates.length === 0) return null;
        const targetId = candidates[Math.floor(Math.random() * candidates.length)];
        // ★リファクタリング: イベント発行の責務を呼び出し元(targetingUtils)に移譲
        return selectRandomPart(world, targetId);
    },

    /**
     * ★新規: [HEALER]: 味方を回復することに専念する、支援的な性格。
     * 味方全体のパーツの中で、最もHPの減りが大きい（最大HP - 現在HP が最大）ものを狙います。
     * ★修正: 候補(candidates)が渡されない場合、自律的に味方全体を検索するよう改善。-> ★リファクタリング: このロジックを削除し、呼び出し元(AiSystem)が候補を渡す責任を持つように変更
     * ★修正: 実際の探索ロジックを再利用可能な queryUtils.findMostDamagedAllyPart に移譲。
     */
    [MedalPersonality.HEALER]: ({ world, candidates, attackerId }) => {
        // ★リファクタリング: AiSystemから渡される候補リスト(candidates)を直接使用する
        // 汎用的なクエリ関数を呼び出して、最も損害の大きい味方パーツを見つける
        return findMostDamagedAllyPart(world, candidates);
    },

    /**
     * ★新規: [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     * 常にnullを返すことで、フォールバックアクションを防ぎます。
     */
    DO_NOTHING: () => null,
};

/**
 * ★新規: AIターゲティング戦略のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 * `personalityRegistry`などで使用されます。
 */
export const TargetingStrategyKey = Object.keys(targetingStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});