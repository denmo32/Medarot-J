/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, GameContext } from '../core/components.js';
// ★改善: PartInfo, PartKeyToInfoMapを参照し、定義元を一元化
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap } from '../common/constants.js';
import { calculateDamage, findBestDefensePart, findNearestEnemy, selectRandomPart, calculateEvasionChance, calculateDefenseChance, calculateCriticalChance } from '../utils/battleUtils.js';
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
        // 格闘攻撃が空振りした場合など、ターゲットが存在しない場合はシーケンスを完了させる
        if (!action || !action.targetId) {
            this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId });
            return;
        };

        const targetParts = this.getCachedComponent(action.targetId, Parts);
        if (!targetParts) return;

        const targetPart = targetParts[action.targetPartKey];
        const newHp = Math.max(0, targetPart.hp - action.damage);
        
        // ★改善: ハードコードされた 'head' を PartInfo.HEAD.key に変更
        const isPartBroken = newHp === 0 && !targetPart.isBroken;
        const isPlayerBroken = action.targetPartKey === PartInfo.HEAD.key && newHp === 0;

        // 1. 先にゲームロジックを確定させるイベント(ACTION_EXECUTED)を発行します。
        // このイベントは同期的であり、これを受け取った各システム（HistorySystemなど）の処理が
        // この場で実行され、ゲームの状態（phaseなど）が即座に更新されます。
        this.world.emit(GameEvents.ACTION_EXECUTED, {
            attackerId: entityId,
            targetId: action.targetId,
            targetPartKey: action.targetPartKey,
            damage: action.damage,
            isPartBroken: isPartBroken,
            isPlayerBroken: isPlayerBroken,
        });

        // ★追加: ゲームオーバーチェック
        // 上記のACTION_EXECUTEDイベントの結果、ゲームのフェーズがGAME_OVERに移行した場合、
        // 後続の「攻撃結果モーダル」は表示せず、処理をここで終了します。
        // これにより、「ゲームオーバー画面」と「攻撃結果画面」の表示が競合するのを防ぎます。
        if (this.context.phase === GamePhaseType.GAME_OVER) {
            // デバッグログは不要になったため削除します。
            return;
        }

        // 2. 次に、UIに結果を表示するためのモーダル表示を要求します。
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: {
                entityId: entityId,
                message: action.resultMessage,
                targetId: action.targetId,
                targetPartKey: action.targetPartKey,
                damage: action.damage
            },
            immediate: true
        });
    }

    /**
     * ★廃止: このメソッドの責務はonAttackDeclarationConfirmedに統合されました。
     */
    // onActionExecutionConfirmed(detail) { ... }

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
        // ★改善: アニメーション要求フローを簡略化。RenderSystemに直接アニメーションを要求する。
        // これにより、ViewSystemの仲介が不要になり、システム間の連携がシンプルになる。
        gameState.state = PlayerStateType.AWAITING_ANIMATION;
        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
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
        const declarationMessage = `${attackerInfo.name}の${attackingPart.type}攻撃！　${attackingPart.trait}！`;
        
        // --- 1. 回避判定 ---
        const evasionChance = calculateEvasionChance(targetLegs.mobility, attackingPart.success);
        const evasionRoll = Math.random();

        if (evasionRoll < evasionChance) {
            // 回避成功
            finalDamage = 0;
            resultMessage = `${targetInfo.name}は攻撃を回避！`;
        } else {
            // 回避失敗（命中確定）
            
            // ★新規: 2. クリティカル判定
            const critChance = calculateCriticalChance(attackingPart, targetLegs);
            const critRoll = Math.random();
            const isCritical = critRoll < critChance;

            let defenseSuccess = false;

            if (isCritical) {
                // クリティカルヒットの場合、防御判定は行わない
                resultMessage = 'クリティカル！　';
            } else {
                // 通常ヒットの場合のみ、防御判定を行う
                const defenseChance = calculateDefenseChance(targetLegs.armor);
                const defenseRoll = Math.random();
                if (defenseRoll < defenseChance) {
                    const defensePartKey = findBestDefensePart(this.world, action.targetId);
                    if (defensePartKey) {
                        defenseSuccess = true;
                        finalTargetPartKey = defensePartKey;
                    }
                }
            }

            // --- 3. ダメージ計算 ---
            // ★変更: isCritical, defenseSuccess の状態に応じて、適切なフラグを立ててダメージ計算を呼び出す
            finalDamage = calculateDamage(
                this.world, 
                executor, 
                action.targetId, 
                action, 
                isCritical, // isCritical: trueなら回避度・防御度を無視
                !isCritical && !defenseSuccess // isDefenseBypassed: クリティカルでなく、かつ防御失敗時にtrue
            );
            
            // ★改善: PartKeyToInfoMap を使用して、パーツキーから日本語名を動的に取得
            const finalTargetPartName = PartKeyToInfoMap[finalTargetPartKey]?.name || '不明な部位';
            if (defenseSuccess) {
                resultMessage = `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
            } else {
                // ★変更: クリティカルの場合、既存のresultMessageに追記する
                resultMessage += `${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
            }
        }
        
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