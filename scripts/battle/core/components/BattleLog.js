/**
 * 個々のメダロットの戦闘履歴を記録するコンポーネント
 */
export class BattleLog {
    constructor() {
        // 最後に自分を攻撃してきた敵のID (Counter性格用)
        /** @type {number | null} */
        this.lastAttackedBy = null;
        // 自分が最後に行った攻撃の情報 (Focus性格用)
        /** @type {object} */
        this.lastAttack = {
            /** @type {number | null} */
            targetId: null,
            /** @type {string | null} */
            partKey: null
        };
    }
}