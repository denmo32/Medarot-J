/**
 * @file MapRequests.js
 * @description マップシーン内のリクエストコンポーネント定義
 */

export class InteractionRequest {
    constructor(entityId) {
        this.entityId = entityId;
    }
}

export class ShowNpcDialogRequest {
    constructor(npcData) {
        this.npcData = npcData;
    }
}

export class ToggleMenuRequest {
    constructor() {}
}

export class MenuActionRequest {
    constructor(actionType) {
        this.actionType = actionType; // 'save', 'medarotchi' etc.
    }
}

export class GameSaveRequest {
    constructor() {}
}