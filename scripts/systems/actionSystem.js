/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */

import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, GameContext } from '../core/components.js';
import { PlayerStateType, PartType, ModalType } from '../common/constants.js';
// ★変更: battleUtilsから追加の関数をインポート
import { calculateDamage, findBestDefensePart, findNearestEnemy, selectRandomPart } from '../utils/battleUtils.js';
import { BaseSystem } from '../core/baseSystem.js';

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

        // ★変更: イベント購読を更新
        this.world.on(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.onAttackDeclarationConfirmed.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, this.onActionExecutionConfirmed.bind(this));
        // ViewSystemからのアニメーション完了通知を購読します。
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * ★新規: 攻撃宣言モーダルが確認された際に呼び出されます。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onAttackDeclarationConfirmed(detail) {
        const { entityId } = detail;
        const action = this.getCachedComponent(entityId, Action);
        if (!action) return;

        // 2段階目の結果メッセージモーダルを表示するよう要求
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: {
                entityId: entityId,
                message: action.resultMessage,
                // ★追加: アニメーション連携用の情報を渡す
                targetId: action.targetId,
                targetPartKey: action.targetPartKey,
                damage: action.damage
            }
        });
    }

    /**
     * プレイヤーがモーダルで「OK」を押し、アクションの実行が確定した際に呼び出されます。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionExecutionConfirmed(detail) {
        const { entityId } = detail;
        const action = this.getCachedComponent(entityId, Action);

        // ★変更: 格闘攻撃がターゲットを見つけられずスキップした場合を考慮
        if (!action || action.targetId === null || action.targetId === undefined) {
            // この場合、updateループで既にACTION_EXECUTEDが発行されているはずなので、ここでは何もしない
            // ただし、UIフローの都合でここに到達した場合は警告を出す
            if (action && action.type !== '格闘') {
                console.warn(`ActionSystem: A non-melee action was confirmed without a target. Entity: ${entityId}`);
            }
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

        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.getCachedComponent(id, GameState)?.state === PlayerStateType.READY_EXECUTE);

        if (executor === undefined || executor === null) return;

        const action = this.getCachedComponent(executor, Action);
        const gameState = this.getCachedComponent(executor, GameState);
        if (!action || !gameState) return;

        // ★追加: 格闘攻撃の場合、実行直前にターゲットを決定する
        if (action.type === '格闘' && action.targetId === null) {
            const nearestEnemyId = findNearestEnemy(this.world, executor);
            
            if (nearestEnemyId !== null) {
                // 最も近い敵にターゲットを設定
                const targetData = selectRandomPart(this.world, nearestEnemyId);
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                } else {
                    // ターゲットはいるが、攻撃可能なパーツがない場合
                    console.warn(`ActionSystem: No valid parts to attack on nearest enemy ${nearestEnemyId}.`);
                    // ★暫定対応: 行動をスキップしてクールダウンに戻す
                    this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0 });
                    return;
                }
            } else {
                // 有効な敵がいない場合
                console.warn(`ActionSystem: No valid enemies for melee attack by ${executor}.`);
                // ★暫定対応: 行動をスキップしてクールダウンに戻す
                this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0 });
                return;
            }
        }

        // 状態をアニメーション待ちに変更し、ViewSystemにアニメーションを要求します。
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
        let declarationMessage = ''; // ★変更: 宣言メッセージ
        let resultMessage = '';      // ★変更: 結果メッセージ
        const targetParts = this.getCachedComponent(action.targetId, Parts);
        const attackerInfo = this.getCachedComponent(executor, PlayerInfo);
        const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);

        if (!targetParts || !attackerInfo || !targetInfo) return;
        
        declarationMessage = `${attackerInfo.name}の${action.type}！`; // ★追加: 宣言メッセージを生成

        let defenseSuccess = false;
        let finalTargetPartKey = action.targetPartKey; // 元のターゲットを保持
        let finalDamage = damage; // 最終的なダメージを保持する変数

        // 回避判定
        if (Math.random() < CONFIG.EVASION_CHANCE) {
            finalDamage = 0;
            resultMessage = `${targetInfo.name}は攻撃を回避！`;
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
                resultMessage = `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
            } else {
                resultMessage = `${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
            }
        }

        // --- 3. 結果をActionコンポーネントに一時保存 ---
        action.targetPartKey = finalTargetPartKey;
        action.damage = finalDamage;
        action.resultMessage = resultMessage; // ★追加: 結果メッセージを保存

        // --- 4. UIに行動結果の表示を要求 (1段階目) ---
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: {
                entityId: executor,
                message: declarationMessage
            }
        });
    }
}
