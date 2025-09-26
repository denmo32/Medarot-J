/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */
import { Parts, PlayerInfo, GameState, BattleLog, GameContext } from '../core/components.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
// ★改善: PartInfoを参照することで、ハードコードされた文字列を排除
import { PlayerStateType, MedalPersonality, PartInfo, TeamID } from '../common/constants.js'; // Import TeamID for context keys, add BattleHistoryContext import
import { isValidTarget, selectRandomPart, getAllEnemyParts, selectPartByCondition, getValidEnemies } from '../utils/queryUtils.js';
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
     */
    [MedalPersonality.HUNTER]: ({ world, enemies }) => {
        return selectPartByCondition(world, enemies, (a, b) => a.part.hp - b.part.hp);
    },
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     * 敵全体のパーツの中で、現在HPが最も高いものを狙います。
     * ★改善: 引数をコンテキストオブジェクトに変更
     */
    [MedalPersonality.CRUSHER]: ({ world, enemies }) => {
        return selectPartByCondition(world, enemies, (a, b) => b.part.hp - a.part.hp);
    },
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     * 敵全体の「攻撃可能な全パーツ」を一つの大きなリストとみなし、その中から完全にランダムで1つをターゲットとします。
     * 結果として、健在なパーツを多く持つ敵が狙われやすくなります。
     * ★改善: 引数をコンテキストオブジェクトに変更
     */
    [MedalPersonality.JOKER]: ({ world, enemies }) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
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
     */
    [MedalPersonality.LEADER_FOCUS]: ({ world, enemies }) => {
        const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
        return leader ? selectRandomPart(world, leader) : null;
    },
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     * まず「敵1体」をランダムに選び、次にその敵のパーツをランダムに狙います。
     * どの敵機体も等しい確率で選ばれます。
     * ★改善: 引数をコンテキストオブジェクトに変更
     */
    [MedalPersonality.RANDOM]: ({ world, enemies }) => {
        if (enemies.length === 0) return null;
        const targetId = enemies[Math.floor(Math.random() * enemies.length)];
        return selectRandomPart(world, targetId);
    }
};