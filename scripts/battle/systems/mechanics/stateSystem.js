import { System } from '../../../../engine/core/System.js';
import { HandleGaugeFullRequest } from '../../components/CommandRequests.js';
import { GaugeFullTag } from '../../components/Requests.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // GaugeFullTag を持つエンティティを監視
        const entities = this.getEntities(GaugeFullTag);
        
        for (const entityId of entities) {
            // タグを消費（削除）
            this.world.removeComponent(entityId, GaugeFullTag);
            
            // ゲージ満タン処理リクエストを生成
            const reqEntity = this.world.createEntity();
            this.world.addComponent(reqEntity, new HandleGaugeFullRequest(entityId));
        }
    }
}