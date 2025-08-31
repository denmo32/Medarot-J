// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
// ★変更: Attackを削除し、Actionのみ使用
import { GameState, PlayerInfo, Parts, Action, GameContext, Medal, BattleLog } from '../components.js';
import { PlayerStateType, PartType, TeamID, MedalPersonality } from '../constants.js';
// ★変更: 汎用的なcalculateDamageとdetermineTargetをインポート
import { calculateDamage } from '../battleUtils.js';

export class ActionSystem {
    constructor(world) {
        this.world = world;
        // ★変更: GameContextへの参照を削除。isPaused()がなくなったため不要。
        // this.context = this.world.getSingletonComponent(GameContext);

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
        // ★変更: isPaused()のチェックを削除。システムは自身の責務に集中し、
        // ゲーム全体の進行管理はGameFlowSystemとStateSystemに委ねる。

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