import { PlayerStateType, PartType, TeamID, TargetTiming } from '../common/constants.js';

/**
 * 戦闘アクションの情報を保持するコンポーネント
 * @class Action
 * @description 
 * アクションの種類、使用するパーツ、ターゲット情報を保持します。
 * 現在は攻撃アクションのみを想定していますが、将来的に移動アクションなども拡張できます。
 */
export class Action {
    constructor() {
        /** @type {string | null} */     // アクションの種類 ('格闘', '射撃'など) - UI表示用
        this.type = null;
        /** @type {string | null} */     // 使用するパーツのキー ('head', 'rightArm'など)
        this.partKey = null;
        /** @type {number | null} */     // ターゲットのエンティティID
        this.targetId = null;
        /** @type {string | null} */     // ターゲットとして選択されたパーツのキー
        this.targetPartKey = null;
        // propertiesオブジェクトを廃止し、アクションの根幹をなす特性を直接のプロパティとして持つ
        /** @type {TargetTiming | null} */ // ターゲット決定タイミング (TargetTiming定数)
        this.targetTiming = null;
    }
}