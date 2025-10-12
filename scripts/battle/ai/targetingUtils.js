/**
 * @file ターゲット決定ユーティリティ
 * 攻撃者のメダルの性格に基づき、ターゲットを決定するためのユーティリティ関数を提供します。
 */
// ★変更: Parts をインポート
import { PlayerInfo, GameState, Medal, Parts } from '../core/components.js'; // PlayerInfo をインポート
// ★変更: EffectScope をインポート
import { PlayerStateType, EffectScope } from '../common/constants.js';
// ★変更: getValidAllies をインポート
import { getValidEnemies, getValidAllies, isValidTarget } from '../utils/queryUtils.js';
import { getStrategiesFor } from './personalityRegistry.js';

/**
 * 攻撃者のメダルの性格と使用パーツに基づき、ターゲット（敵or味方エンティティとパーツ）を決定します。
 * 
 * ★修正: パーツの `targetScope` を考慮するようにロジックを更新
 * 1. 使用するパーツの `targetScope` を確認します。
 * 2. `ALLY_...` スコープの場合は味方を、`ENEMY_...` スコープの場合は敵をターゲット候補とします。
 * 3. `ALLY_TEAM` や `SELF` のように単体ターゲットが不要な場合は null を返します。
 * 4. 性格に基づいた戦略がターゲットを見つけられない場合、フォールバック戦略で再試行します。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {string} partKey - 使用するパーツのキー
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId, partKey) {
    const attackerMedal = world.getComponent(attackerId, Medal);
    const parts = world.getComponent(attackerId, Parts);
    const selectedPart = parts[partKey];

    // パーツが存在しない、またはtargetScopeがなければ処理を中断
    if (!selectedPart || !selectedPart.targetScope) {
        console.warn(`determineTarget: Part ${partKey} or its targetScope is missing.`);
        return null;
    }

    // ターゲットが不要なスコープの場合は即座にnullを返す
    if ([EffectScope.ALLY_TEAM, EffectScope.SELF].includes(selectedPart.targetScope)) {
        return null;
    }

    // ターゲット候補のリストをスコープに応じて決定
    let targetCandidates;
    if (selectedPart.targetScope.startsWith('ALLY_')) {
        targetCandidates = getValidAllies(world, attackerId, true); // 自分を含む味方
    } else { // ENEMY_...
        targetCandidates = getValidEnemies(world, attackerId);
    }
    
    if (targetCandidates.length === 0) return null;

    // 戦略の実行に必要なコンテキストを作成
    const strategyContext = {
        world,
        attackerId,
        // ★修正: キーを 'enemies' から 'candidates' に変更し、意図を明確化
        candidates: targetCandidates, 
    };

    // レジストリから性格に合った戦略セットを取得
    const strategies = getStrategiesFor(attackerMedal.personality);

    // 手順1: 本来の性格に基づいた戦略でターゲット候補を決定します。
    let target = strategies.primaryTargeting(strategyContext);
    
    // 手順2: ターゲット候補が「存在しない」または「無効（破壊済みなど）」であるか検証します。
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
        // プライマリ戦略が失敗したため、フォールバック戦略を実行する。
        // この際、使用パーツの目的に合わないターゲットを選択しないよう、
        // フォールバック用のターゲット候補を `targetScope` に基づいて厳密に再定義し、
        // 味方への誤攻撃や敵への誤回復を防ぐ。

        let fallbackCandidates;
        
        // 【攻撃パーツの場合】フォールバック候補は必ず「敵」のみとする。
        if (selectedPart.targetScope.startsWith('ENEMY_')) {
            fallbackCandidates = getValidEnemies(world, attackerId);
        }
        // 【支援パーツの場合】フォールバック候補は必ず「味方」のみとする。
        else if (selectedPart.targetScope.startsWith('ALLY_')) {
            // プライマリ戦略で使った候補リストをそのまま利用する。
            fallbackCandidates = targetCandidates; 
        }

        // フォールバック候補が存在する場合のみ、戦略を実行する
        if (fallbackCandidates && fallbackCandidates.length > 0) {
            const contextForFallback = {
                world,
                attackerId,
                // ★修正: キーを 'enemies' から 'candidates' に変更
                candidates: fallbackCandidates, 
            };
            target = strategies.fallbackTargeting(contextForFallback);
        } else {
            // フォールバックできる候補がいない場合は、行動をキャンセルする。
            target = null;
        }

        // フォールバック後もターゲットが無効であれば、最終的に行動をキャンセルする。
        if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
            console.warn(`Fallback strategy also failed for ${attackerId}. Action cancelled.`);
            return null;
        }
        // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
    }
    
    return target;
}