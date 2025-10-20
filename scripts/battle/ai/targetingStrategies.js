/**
 * @file AIターゲティング戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様なターゲティング戦略（アルゴリズム）を定義します。
 */
import { Parts, PlayerInfo, GameState, BattleLog } from '../core/components/index.js';
// [リファクタリング] 古いコンテキストを新しいBattleContextに置き換えます。
import { BattleContext } from '../core/index.js';
import { PlayerStateType, MedalPersonality, PartInfo, TeamID } from '../common/constants.js';
import { isValidTarget, selectRandomPart, getAllPartsFromCandidates, selectPartByCondition, getValidEnemies, getValidAllies, findMostDamagedAllyPart } from '../utils/queryUtils.js';
import { GameEvents } from '../common/events.js';

/**
 * AIターゲティング戦略のキーを定義する定数。
 */
export const TargetingStrategyKey = {
    ...MedalPersonality,
    DO_NOTHING: 'DO_NOTHING',
};

/**
 * メダルの性格に基づいたターゲット決定戦略のコレクション。
 */
export const targetingStrategies = {
    /**
     * [HUNTER]: 弱った敵から確実に仕留める、狩人のような性格。
     */
    [TargetingStrategyKey.HUNTER]: ({ world, candidates, attackerId }) => {
        return selectPartByCondition(world, candidates, (a, b) => a.part.hp - b.part.hp);
    },
    /**
     * [CRUSHER]: 頑丈なパーツを先に破壊し、敵の耐久力を削ぐ、破壊者のような性格。
     */
    [TargetingStrategyKey.CRUSHER]: ({ world, candidates, attackerId }) => {
        return selectPartByCondition(world, candidates, (a, b) => b.part.hp - a.part.hp);
    },
    /**
     * [JOKER]: 行動が予測不能で、戦況をかき乱す、トリックスターのような性格。
     */
    [TargetingStrategyKey.JOKER]: ({ world, candidates, attackerId }) => {
        const allParts = getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },
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
        // [リファクタリング] BattleContextから履歴データを参照します。
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
        return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
    },
    /**
     * [ASSIST]: 味方と連携して同じ敵を攻撃する、協調的な性格。
     */
    [TargetingStrategyKey.ASSIST]: ({ world, attackerId }) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        // [リファクタリング] BattleContextから履歴データを参照します。
        const context = world.getSingletonComponent(BattleContext);
        if (context && context.history.teamLastAttack) {
            const teamLastAttack = context.history.teamLastAttack[attackerInfo.teamId];
            return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
        } else {
            console.warn('BattleContext not ready for ASSIST strategy, returning null for fallback.');
            return null;
        }
    },
    /**
     * [LEADER_FOCUS]: リーダーを集中攻撃し、早期決着を狙う、極めて攻撃的な性格。
     */
    [TargetingStrategyKey.LEADER_FOCUS]: ({ world, candidates, attackerId }) => {
        const leader = candidates.find(id => world.getComponent(id, PlayerInfo).isLeader);
        return leader ? selectRandomPart(world, leader) : null;
    },
    /**
     * [RANDOM]: 基本的な性格であり、他の戦略が条件を満たさず実行できない場合の安全策（フォールバック）としての役割も持ちます。
     */
    [TargetingStrategyKey.RANDOM]: ({ world, candidates, attackerId }) => {
        if (!candidates || candidates.length === 0) return null;
        const targetId = candidates[Math.floor(Math.random() * candidates.length)];
        return selectRandomPart(world, targetId);
    },

    /**
     * [HEALER]: 味方を回復することに専念する、支援的な性格。
     */
    [TargetingStrategyKey.HEALER]: ({ world, candidates, attackerId }) => {
        return findMostDamagedAllyPart(world, candidates);
    },

    /**
     * [DO_NOTHING]: ターゲット選択に失敗した場合に、意図的に行動をキャンセルさせるための戦略。
     */
    [TargetingStrategyKey.DO_NOTHING]: () => null,
};