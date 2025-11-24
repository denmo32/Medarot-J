/**
 * @file Timer System
 * @description Timerコンポーネントを持つエンティティを処理するシステム。
 * 毎フレーム、タイマーの残り時間を更新し、0になったらコールバックを実行してエンティティを破棄します。
 */
import { BaseSystem } from '../baseSystem.js';
import { Timer } from '../components/Timer.js';

export class TimerSystem extends BaseSystem {
    constructor(world) {
        super(world);
    }

    /**
     * @param {number} deltaTime - 前フレームからの経過時間
     */
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(Timer);

        for (const entityId of entities) {
            const timer = this.world.getComponent(entityId, Timer);
            
            timer.duration -= deltaTime;

            if (timer.duration <= 0) {
                // コールバックを実行
                if (typeof timer.onComplete === 'function') {
                    timer.onComplete();
                }
                // 処理が完了したタイマーエンティティを破棄
                this.world.destroyEntity(entityId);
            }
        }
    }
}