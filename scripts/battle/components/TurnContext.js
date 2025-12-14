/**
 * @file TurnContext.js
 * @description ターン管理の状態を保持するコンポーネント。
 * actionQueue は廃止され、ActionSelectionPending コンポーネントによる管理へ移行しました。
 */
import { BattlePhase } from '../common/constants.js';

export class TurnContext {
    constructor() {
        this.number = 0;
        this.currentActorId = null;
        // actionQueue = []; // 廃止
        this.selectedActions = new Map(); // ActionSelectionSystemによって設定されるMap
    }
}