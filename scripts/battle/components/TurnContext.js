/**
 * @file TurnContext.js
 * @description ターン管理の状態を保持するコンポーネント。
 */
import { BattlePhase } from '../common/constants.js';

export class TurnContext {
    constructor() {
        this.number = 0;
        this.currentActorId = null;
        this.actionQueue = [];
        this.selectedActions = new Map(); // ActionSelectionSystemによって設定されるMap
    }
}