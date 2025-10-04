import { PlayerInfo, Position, Gauge, GameState, Parts } from '../core/components.js';
import { PlayerStateType, TeamID } from '../common/constants.js'; // TeamIDをインポート
import { BaseSystem } from '../../core/baseSystem.js';
// import { GameEvents } from '../common/events.js'; // 削除
import { UIManager } from './UIManager.js';

export class RenderSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // ★改善: アニメーション要求イベントを直接購読
        // これにより、ViewSystemの仲介をなくし、システム間の連携をシンプルにします。
        // this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this)); // 削除
    }
    update(deltaTime) {
        // RenderSystem はゲームオブジェクトの状態（座標、HPなど）を計算する責任があります。
        // DOM要素の更新はUISystemの役割です。
        // したがって、このメソッドは空にするか、ゲームオブジェクトの状態更新のロジックに置き換える必要があります。
        // 例: ゲームオブジェクトの位置やHPの計算
        const entities = this.world.getEntitiesWith(Position, GameState); // 必要なコンポーネントのみを取得
        for (const entityId of entities) {
            // 位置や状態の更新ロジックをここに記述
        }
    }
}