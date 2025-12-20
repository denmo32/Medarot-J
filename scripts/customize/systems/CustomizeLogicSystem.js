/**
 * @file CustomizeLogicSystem.js
 * @description カスタマイズロジックシステム。
 * リクエストコンポーネントを処理し、結果タグを発行する。
 */
import { System } from '../../../engine/core/System.js';
import { EquipPartRequest, EquipMedalRequest, ItemEquippedTag } from '../components/CustomizeRequests.js';

export class CustomizeLogicSystem extends System {
    constructor(world, gameDataManager) {
        super(world);
        this.dataManager = gameDataManager;
    }

    update(deltaTime) {
        const partRequests = this.getEntities(EquipPartRequest);
        for (const id of partRequests) {
            const req = this.world.getComponent(id, EquipPartRequest);
            this.equipPart(req.medarotIndex, req.partSlot, req.newPartId);
            this.world.destroyEntity(id);
        }

        const medalRequests = this.getEntities(EquipMedalRequest);
        for (const id of medalRequests) {
            const req = this.world.getComponent(id, EquipMedalRequest);
            this.equipMedal(req.medarotIndex, req.newMedalId);
            this.world.destroyEntity(id);
        }
    }

    equipPart(medarotIndex, partSlot, newPartId) {
        if (!newPartId) return;
        this.dataManager.updateMedarotPart(medarotIndex, partSlot, newPartId);
        
        // 完了通知タグ発行
        this.world.addComponent(this.world.createEntity(), new ItemEquippedTag());
    }

    equipMedal(medarotIndex, newMedalId) {
        if (!newMedalId) return;
        this.dataManager.updateMedarotMedal(medarotIndex, newMedalId);
        
        // 完了通知タグ発行
        this.world.addComponent(this.world.createEntity(), new ItemEquippedTag());
    }
}