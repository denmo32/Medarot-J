// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
// ★変更: Attackを削除し、Actionのみ使用
import { GameState, PlayerInfo, Parts, Action, GameContext, Medal, BattleLog } from '../components.js';
// ★変更: ModalTypeを追加でインポート
import { PlayerStateType, PartType, TeamID, MedalPersonality, ModalType } from '../constants.js';
// ★変更: 汎用的なcalculateDamageとdetermineTargetをインポート
import { calculateDamage, findBestDefensePart } from '../battleUtils.js';
import { BaseSystem } from './baseSystem.js';

export class ActionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.context = this.world.getSingletonComponent(GameContext);

        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, this.onActionExecutionConfirmed.bind(this));
    }

    onActionExecutionConfirmed(detail) {
        const { entityId } = detail;
        // ★変更: Attackの代わりにActionコンポーネントを取得
        const action = this.world.getComponent(entityId, Action);

        if (!action || action.targetId === null || action.targetId === undefined) {
            console.warn(`ActionSystem: ターゲット未定のまま実行が確認されました。Entity: ${entityId}`);
            return;
        }
        
        const target = this.world.getComponent(action.targetId, Parts);
        if (!target) {
            console.warn(`ActionSystem: ターゲットエンティティが見つかりません。TargetID: ${action.targetId}`);
            return;
        }

        // ダメージ計算はすでに行われているので、ここではイベントを発行するだけ
        const targetPart = target[action.targetPartKey];
        const newHp = Math.max(0, targetPart.hp - action.damage);

        // StateSystemに行動の結果を通知する
        this.world.emit(GameEvents.ACTION_EXECUTED, {
            attackerId: entityId,
            targetId: action.targetId,
            targetPartKey: action.targetPartKey,
            damage: action.damage,
            isPartBroken: newHp === 0,
            isPlayerBroken: action.targetPartKey === PartType.HEAD && newHp === 0,
        });
    }

    update(deltaTime) {
        // モーダル表示中は処理を中断
        if (this.context.isPausedByModal) return;

        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.world.getComponent(id, GameState).state === PlayerStateType.READY_EXECUTE);

        if (executor === undefined || executor === null) return;

        const action = this.world.getComponent(executor, Action);

        // ★削除: ターゲット決定処理を削除。
        // ターゲットは、AIの場合はDecisionSystem、プレイヤーの場合はStateSystemで、
        // 行動が選択されたタイミングで既に決定され、Actionコンポーネントに格納されている。
        // これにより、ActionSystemは純粋に「決定された行動を実行する」責務に集中できる。

        // --- ダメージ計算 ---
        // Actionコンポーネントに保存された情報に基づき、ダメージを計算します。
        const damage = calculateDamage(this.world, executor, action.targetId, action);

        // --- ★修正: 回避・防御判定とメッセージ生成 ---
        let message = '';
        const targetParts = this.world.getComponent(action.targetId, Parts);
        const attackerInfo = this.world.getComponent(executor, PlayerInfo);
        const targetInfo = this.world.getComponent(action.targetId, PlayerInfo);
        
        let defenseSuccess = false;
        let finalTargetPartKey = action.targetPartKey; // 元のターゲットを保持
        let finalDamage = damage; // 最終的なダメージを保持する変数

        // 25%の確率で回避を試みる
        if (Math.random() < 0.25) {
            // 回避成功
            finalDamage = 0;
            message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}は攻撃を回避！`;
        } else {
            // 回避失敗 -> 防御判定へ
            // 50%の確率で防御を試みる
            if (Math.random() < 0.5) {
                const defensePartKey = findBestDefensePart(this.world, action.targetId);
                if (defensePartKey) {
                    defenseSuccess = true;
                    finalTargetPartKey = defensePartKey; // 最終的なターゲットを更新
                }
            }
    
            const finalTargetPartName = targetParts[finalTargetPartKey].name;
    
            // メッセージを条件分岐で生成
            if (defenseSuccess) {
                message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
            } else {
                message = `${attackerInfo.name}の${action.type}！ ${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
            }
        }

        // 最終的なターゲットとダメージ情報をActionコンポーネントに保存
        action.targetPartKey = finalTargetPartKey;
        action.damage = finalDamage;

        // --- 攻撃実行モーダルの表示要求 ---
        this.world.emit(GameEvents.SHOW_MODAL, {
            // ★変更: マジックストリングを定数に変更
            type: ModalType.EXECUTION,
            data: {
                entityId: executor,
                message: message
            }
        });
    }

    
}
