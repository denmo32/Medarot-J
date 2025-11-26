/**
 * @file Timer System
 * @description 標準ライブラリ: タイマー処理システム
 */
import { System } from '../../core/System.js';
import { Timer } from '../components/Timer.js';

export class TimerSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(Timer);

        for (const entityId of entities) {
            const timer = this.world.getComponent(entityId, Timer);
            
            timer.duration -= deltaTime;

            if (timer.duration <= 0) {
                if (typeof timer.onComplete === 'function') {
                    timer.onComplete();
                }
                this.world.destroyEntity(entityId);
            }
        }
    }
}