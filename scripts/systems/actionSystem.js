// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
// ★変更: Attackを削除し、Actionのみ使用
import { GameState, PlayerInfo, Parts, Action, GameContext, Medal, BattleLog } from '../components.js';
import { PlayerStateType, PartType, TeamID, MedalPersonality } from '../constants.js';
// ★変更: 汎用的なcalculateDamageとdetermineTargetをインポート
import { calculateDamage, determineTarget } from '../battleUtils.js';

export class ActionSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
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
        if (this.context.isPaused()) return;

        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.world.getComponent(id, GameState).state === PlayerStateType.READY_EXECUTE);

        if (executor === undefined || executor === null) return;

        // ★変更: Attackの代わりにActionコンポーネントを取得
        const action = this.world.getComponent(executor, Action);

        // --- ターゲット決定処理 ---
        // ★変更: Actionコンポーネントにターゲットが未設定の場合（＝プレイヤーの行動）のみ、ここでターゲットを決定します。
        // AIの場合はDecisionSystemで事前にターゲットが決定され、Actionコンポーネントに保存されています。
        if (action.targetId === null || action.targetId === undefined) {
            // ★変更: battleUtilsに集約されたロジックを呼び出す
            const target = determineTarget(this.world, executor);
            if (!target) {
                // ターゲットが見つからない場合は行動をスキップして完了させます。
                console.warn(`ActionSystem: ターゲットが見つからなかったため、行動をスキップします。Attacker: ${executor}`);
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: executor });
                return;
            }
            // 決定したターゲットをActionコンポーネントに設定します。
            action.targetId = target.targetId;
            action.targetPartKey = target.targetPartKey;
        }

        // --- ダメージ計算 ---
        // これで全実行者のターゲット情報が確定したので、ダメージを計算します。
        const damage = calculateDamage(this.world, executor, action.targetId, action);
        action.damage = damage;

        // --- 攻撃実行モーダルの表示要求 ---
        const attackerInfo = this.world.getComponent(executor, PlayerInfo);
        const targetInfo = this.world.getComponent(action.targetId, PlayerInfo);
        const targetParts = this.world.getComponent(action.targetId, Parts);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: 'execution',
            data: {
                entityId: executor,
                message: `${attackerInfo.name}の${action.type}！ ${targetInfo.name}の${targetParts[action.targetPartKey].name}に${damage}ダメージ！`
            }
        });
    }

    
}