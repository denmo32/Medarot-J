/**
 * @file CustomizeRequests.js
 */

export class CustomizeNavigateRequest {
    constructor(direction) {
        this.direction = direction;
    }
}

export class CustomizeConfirmRequest { constructor() {} }
export class CustomizeCancelRequest { constructor() {} }

export class EquipPartRequest {
    constructor(medarotIndex, partSlot, newPartId) {
        this.medarotIndex = medarotIndex;
        this.partSlot = partSlot;
        this.newPartId = newPartId;
    }
}

export class EquipMedalRequest {
    constructor(medarotIndex, newMedalId) {
        this.medarotIndex = medarotIndex;
        this.newMedalId = newMedalId;
    }
}

export class ItemEquippedTag { constructor() {} }