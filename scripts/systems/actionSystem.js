/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, GameContext } from '../core/components.js';
import { PlayerStateType, PartType, ModalType } from '../common/constants.js';
// ★変更: battleUtilsから追加の関数をインポート
import { calculateDamage, findBestDefensePart, findNearestEnemy, selectRandomPart, calculateEvasionChance, calculateDefenseChance } from '../utils/battleUtils.js';
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
        
        // ★修正: 即座に実行結果モーダルを表示（シーケンス管理をスキップ）
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: {
                entityId: entityId,
                message: action.resultMessage,
                // アニメーション連携用の情報を渡す
                targetId: action.targetId,
                targetPartKey: action.targetPartKey,
                damage: action.damage
            },
            immediate: true // ★追加: 即座表示フラグ
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
        const attackerInfo = this.getCachedComponent(executor, PlayerInfo);
        const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);
        const attackerParts = this.getCachedComponent(executor, Parts);
        const targetParts = this.getCachedComponent(action.targetId, Parts);
        if (!attackerInfo || !targetInfo || !attackerParts || !targetParts) return;
        const attackingPart = attackerParts[action.partKey];
        const targetLegs = targetParts.legs;
        let finalDamage = 0;
        let finalTargetPartKey = action.targetPartKey;
        let resultMessage = '';
        const declarationMessage = `${attackerInfo.name}の${action.type}！`;
        console.log(`=================================================`);
        console.log(`攻撃シーケンス開始: ${attackerInfo.name} -> ${targetInfo.name}`);
        
        // --- 1. 回避判定 ---
        // ★変更: calculateEvasionChanceヘルパー関数を使用
        const evasionChance = calculateEvasionChance(targetLegs.mobility, attackingPart.success);
        const evasionRoll = Math.random();
        console.log(`--- 回避判定 (Target: ${action.targetId}) ---`);
        console.log(`  - ターゲット機動: ${targetLegs.mobility}, 攻撃側成功: ${attackingPart.success}`);
        console.log(`  - 回避成功率: ${Math.round(evasionChance * 100)}%`);
        console.log(`  - 乱数: ${evasionRoll.toFixed(2)}`);
        if (evasionRoll < evasionChance) {
            // 回避成功
            finalDamage = 0;
            resultMessage = `${targetInfo.name}は攻撃を回避！`;
            console.log(`  - 結果: 回避成功`);
        } else {
            // 回避失敗
            console.log(`  - 結果: 回避失敗`);
            // --- 2. 防御判定 ---
            // ★変更: calculateDefenseChanceヘルパー関数を使用
            const defenseChance = calculateDefenseChance(targetLegs.armor);
            const defenseRoll = Math.random();
            console.log(`--- 防御判定 (Target: ${action.targetId}) ---`);
            console.log(`  - ターゲット防御: ${targetLegs.armor}`);
            console.log(`  - 防御成功率: ${Math.round(defenseChance * 100)}%`);
            console.log(`  - 乱数: ${defenseRoll.toFixed(2)}`);
            let defenseSuccess = false;
            if (defenseRoll < defenseChance) {
                const defensePartKey = findBestDefensePart(this.world, action.targetId);
                if (defensePartKey) {
                    defenseSuccess = true;
                    finalTargetPartKey = defensePartKey;
                    console.log(`  - 結果: 防御成功 (防御パーツ: ${defensePartKey})`);
                } else {
                    console.log(`  - 結果: 防御失敗 (防御可能パーツなし)`);
                }
            } else {
                console.log(`  - 結果: 防御失敗`);
            }
            // --- 3. ダメージ計算 ---
            finalDamage = calculateDamage(this.world, executor, action.targetId, action);
            const finalTargetPartName = targetParts[finalTargetPartKey].name;
            if (defenseSuccess) {
                resultMessage = `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
            } else {
                resultMessage = `${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
            }
        }
        console.log(`=================================================`);
        // --- 4. 結果をActionコンポーネントに一時保存 ---
        action.targetPartKey = finalTargetPartKey;
        action.damage = finalDamage;
        action.resultMessage = resultMessage;
        action.declarationMessage = declarationMessage; // ★追加: 宣言メッセージも保存
        
        // ★修正: 即座に攻撃宣言モーダルを表示（シーケンス管理をスキップ）
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: {
                entityId: executor,
                message: declarationMessage
            },
            immediate: true // ★追加: 即座表示フラグ
        });
    }
}