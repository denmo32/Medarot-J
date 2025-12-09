/**
 * エンティティに適用されている効果（バフ・デバフ）を管理するコンポーネント
 */
export class ActiveEffects {
    constructor() {
        /** 
         * @type {Array<{
         *   type: string, 
         *   value: number, 
         *   duration: number, // ターン数
         *   partKey?: string,
         *   // 以下、拡張用プロパティ
         *   tickInterval?: number, // 時間経過処理用 (ms)
         *   elapsedTime?: number,  // 時間経過処理用 累積時間
         *   isTrap?: boolean,      // トラップフラグ
         *   triggerType?: string,  // トラップ発動条件フック名
         *   condition?: object     // トラップ発動詳細条件
         * }>} 
         */
        this.effects = [];
    }
}