/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { GameState, PlayerInfo, Parts, Action, GameContext } from '../components.js';
import { PlayerStateType, PartType, ModalType } from '../constants.js';
import { calculateDamage, findBestDefensePart } from '../utils/battleUtils.js';
import { BaseSystem } from './baseSystem.js';

/**
 * 「行動の実行」に特化したシステム。
 * なぜこのシステムが必要か？
 * StateSystemがエンティティを「行動実行準備完了」状態にした後、このシステムがバトンを受け取ります。
 * ダメージ計算、命中判定、結果のUI表示、最終的な結果の適用、といった一連の処理は複雑です。
 * これらを状態管理から分離することで、それぞれのロジックをシンプルに保ち、見通しを良くしています。
 */
export class ActionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.context = this.world.getSingletonComponent(GameContext);

        // プレイヤーがUIで攻撃実行を確認した時に、最終的な結果を適用するためにイベントを購読します。
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, this.onActionExecutionConfirmed.bind(this));
        // ViewSystemからのアニメーション完了通知を購読します。
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * プレイヤーがモーダルで「OK」を押し、アクションの実行が確定した際に呼び出されます。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionExecutionConfirmed(detail) {
        const { entityId } = detail;
        const action = this.getCachedComponent(entityId, Action);

        if (!action || action.targetId === null || action.targetId === undefined) {
            console.warn(`ActionSystem: ターゲット未定のまま実行が確認されました。Entity: ${entityId}`);
            return;
        }

        const target = this.getCachedComponent(action.targetId, Parts);
        if (!target) {
            console.warn(`ActionSystem: ターゲットエンティティが見つかりません。TargetID: ${action.targetId}`);
            return;
        }

        // updateで計算済みの最終的なダメージを基に、ターゲットのHPを計算します。
        const targetPart = target[action.targetPartKey];
        const newHp = Math.max(0, targetPart.hp - action.damage);

        // StateSystemに「アクションが完了した」ことを、最終結果と共に通知します。
        // これを受けてStateSystemが、攻撃者とターゲットの状態を更新します。
        this.world.emit(GameEvents.ACTION_EXECUTED, {
            attackerId: entityId,
            targetId: action.targetId,
            targetPartKey: action.targetPartKey,
            damage: action.damage,
            isPartBroken: newHp === 0,
            isPlayerBroken: action.targetPartKey === PartType.HEAD && newHp === 0,
        });
    }

    /**
     * 毎フレーム実行され、「行動実行準備完了」状態のエンティティを探して処理します。
     */
    update(deltaTime) {
        if (this.context.isPausedByModal) return;

        // 行動を実行すべきエンティティを探します。
        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.getCachedComponent(id, GameState)?.state === PlayerStateType.READY_EXECUTE);

        if (executor === undefined || executor === null) return;

        const action = this.getCachedComponent(executor, Action);
        const gameState = this.getCachedComponent(executor, GameState);
        if (!action || !gameState) return;

        // 状態をアニメーション待ちに変更し、ViewSystemにアニメーションを要求します。
        // ダメージ計算などのロジックは、アニメーション完了後に onExecutionAnimationCompleted で実行されます。
        gameState.state = PlayerStateType.AWAITING_ANIMATION;
        this.world.emit(GameEvents.EXECUTION_ANIMATION_REQUESTED, {
            attackerId: executor,
            targetId: action.targetId
        });
    }

    /**
     * ViewSystemでの実行アニメーションが完了した際に呼び出されます。
     * ダメージ計算や命中判定を行い、結果をモーダルで表示するよう要求します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onExecutionAnimationCompleted(detail) {
        const { entityId: executor } = detail;
        const action = this.getCachedComponent(executor, Action);
        if (!action) return;

        // --- 1. ダメージの基本値を計算 ---
        const damage = calculateDamage(this.world, executor, action.targetId, action);

        // --- 2. 命中判定（回避・防御）と最終ダメージの決定 ---
        let message = '';
        const targetParts = this.getCachedComponent(action.targetId, Parts);
        const attackerInfo = this.getCachedComponent(executor, PlayerInfo);
        const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);

        if (!targetParts || !attackerInfo || !targetInfo) return;
        
        let defenseSuccess = false;
        let finalTargetPartKey = action.targetPartKey; // 元のターゲットを保持
        let finalDamage = damage; // 最終的なダメージを保持する変数

        // 回避判定
        if (Math.random() < CONFIG.EVASION_CHANCE) {
            finalDamage = 0;
            message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}は攻撃を回避！`;
        } else {
            // 防御判定
            if (Math.random() < CONFIG.DEFENSE_CHANCE) {
                const defensePartKey = findBestDefensePart(this.world, action.targetId);
                if (defensePartKey) {
                    defenseSuccess = true;
                    finalTargetPartKey = defensePartKey; // ターゲットを防御パーツに変更
                }
            }
    
            const finalTargetPartName = targetParts[finalTargetPartKey].name;
    
            if (defenseSuccess) {
                message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
            } else {
                message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
            }
        }

        // --- 3. 結果をActionコンポーネントに一時保存 ---
        action.targetPartKey = finalTargetPartKey;
        action.damage = finalDamage;

        // --- 4. UIに行動結果の表示を要求 ---
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION,
            data: {
                entityId: executor,
                message: message
            }
        });
    }
}