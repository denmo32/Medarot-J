/**
 * エンティティに適用されている効果（バフ・デバフ）を管理するコンポーネント
 */
export class ActiveEffects {
    constructor() {
        // 例: [{ type: 'SCAN', value: 5, duration: 3 }, { type: 'ATTACK_UP', value: 1.2, duration: 2 }]
        /** @type {Array} */
        this.effects = [];
    }
}