import { System } from '../../../engine/core/System.js';
import { GameEvents } from '../../common/events.js';

export class CustomizeLogicSystem extends System {
    /**
     * @param {World} world 
     * @param {GameDataManager} gameDataManager 依存性注入
     */
    constructor(world, gameDataManager) {
        super(world);
        this.dataManager = gameDataManager;

        this.on(GameEvents.EQUIP_PART_REQUESTED, this.onEquipPartRequested.bind(this));
        this.on(GameEvents.EQUIP_MEDAL_REQUESTED, this.onEquipMedalRequested.bind(this));
    }

    onEquipPartRequested(detail) {
        const { medarotIndex, partSlot, newPartId } = detail;
        this.equipPart(medarotIndex, partSlot, newPartId);
    }

    onEquipMedalRequested(detail) {
        const { medarotIndex, newMedalId } = detail;
        this.equipMedal(medarotIndex, newMedalId);
    }

    equipPart(medarotIndex, partSlot, newPartId) {
        if (!newPartId) return;
        this.dataManager.updateMedarotPart(medarotIndex, partSlot, newPartId);
        this.world.emit(GameEvents.PART_EQUIPPED);
    }

    equipMedal(medarotIndex, newMedalId) {
        if (!newMedalId) return;
        this.dataManager.updateMedarotMedal(medarotIndex, newMedalId);
        this.world.emit(GameEvents.MEDAL_EQUIPPED);
    }
}